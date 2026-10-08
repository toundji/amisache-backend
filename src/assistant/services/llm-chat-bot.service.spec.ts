import { LlmChatBotService } from './llm-chat-bot.service';
import { LOOP_LIMIT_REPLY, MAX_TOOL_ROUNDS } from '../assistant.constants';
import { ActorType } from '../../shared/common.enum';

const toolCall = (name: string, args: Record<string, any> = {}) => ({
  id: `call-${name}`,
  type: 'function' as const,
  function: { name, arguments: JSON.stringify(args) },
});

/** Réponse du client LLM : un message assistant (texte ou tool_calls). */
const llm = (message: Record<string, any>) => ({ message, model: 'test-model' });

describe('LlmChatBotService', () => {
  const conversation = { id: 'conv-1' } as any;
  let client: { complete: jest.Mock };
  let chatBotService: any;
  let chatService: any;
  let churchService: any;
  let tools: any;
  let notifier: any;
  let service: LlmChatBotService;

  beforeEach(() => {
    client = { complete: jest.fn() };
    chatBotService = {
      registerEngine: jest.fn(),
      keywordReply: jest.fn().mockResolvedValue('réponse FAQ'),
    };
    chatService = {
      recentTextMessages: jest
        .fn()
        .mockResolvedValue([{ senderType: ActorType.HUMAN, body: 'À quelle heure est la messe ?' }]),
    };
    churchService = { getPublicBySlug: jest.fn() };
    tools = {
      execute: jest.fn().mockResolvedValue({ ok: true }),
      escalate: jest.fn().mockResolvedValue({ escalated: true }),
    };
    notifier = { alertLlmUnavailable: jest.fn().mockResolvedValue(undefined) };
    service = new LlmChatBotService(
      client as any,
      chatBotService,
      chatService,
      churchService,
      tools,
      notifier,
    );
  });

  const reply = () => service.reply({ conversation, actorId: 'user-1', body: 'question' });

  it("s'enregistre comme moteur du bot au démarrage", () => {
    service.onModuleInit();
    expect(chatBotService.registerEngine).toHaveBeenCalledWith(service);
  });

  it('exécute les tools puis renvoie la réponse finale avec la trace', async () => {
    client.complete
      .mockResolvedValueOnce(llm({ tool_calls: [toolCall('search_faq', { query: 'messe' })] }))
      .mockResolvedValueOnce(llm({ content: 'La messe est à 9h.' }));

    const result = await reply();

    expect(tools.execute).toHaveBeenCalledWith(
      'search_faq',
      { query: 'messe' },
      expect.objectContaining({ conversationId: 'conv-1', userId: 'user-1' }),
      expect.anything(),
    );
    expect(result?.body).toBe('La messe est à 9h.');
    expect(result?.meta?.trace).toHaveLength(1);
    // le résultat du tool est renvoyé au LLM au tour suivant
    const secondCallMessages = client.complete.mock.calls[1][0].messages;
    expect(secondCallMessages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call-search_faq' });
  });

  it("renvoie l'erreur d'un tool au LLM sans faire échouer la boucle", async () => {
    tools.execute.mockRejectedValueOnce(new Error('DB down'));
    client.complete
      .mockResolvedValueOnce(llm({ tool_calls: [toolCall('get_mass_schedule')] }))
      .mockResolvedValueOnce(llm({ content: 'Désolé.' }));

    const result = await reply();

    expect(result?.body).toBe('Désolé.');
    expect(result?.meta?.trace[0].result).toEqual({ error: 'DB down' });
    expect(notifier.alertLlmUnavailable).not.toHaveBeenCalled();
  });

  it('se replie sur la recherche mot-clé et alerte les admins si le LLM échoue', async () => {
    client.complete.mockRejectedValue(new Error('503'));

    const result = await reply();

    expect(result).toEqual({
      body: 'réponse FAQ',
      meta: expect.objectContaining({ fallback: true, error: '503' }),
    });
    expect(notifier.alertLlmUnavailable).toHaveBeenCalled();
  });

  it(`escalade et transmet après ${MAX_TOOL_ROUNDS} tours de tools`, async () => {
    client.complete.mockResolvedValue(llm({ tool_calls: [toolCall('search_church', { query: 'x' })] }));

    const result = await reply();

    expect(client.complete).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(tools.escalate).toHaveBeenCalled();
    expect(result?.body).toBe(LOOP_LIMIT_REPLY);
  });

  it('reste silencieux quand il ré-escalade une conversation déjà escaladée', async () => {
    tools.execute.mockImplementation(async (_name, _args, _ctx, run) => {
      run.reEscalated = true;
      return { escalated: true };
    });
    client.complete
      .mockResolvedValueOnce(llm({ tool_calls: [toolCall('escalate_to_agent', { reason: 'r' })] }))
      .mockResolvedValueOnce(llm({ content: 'Votre question a été transmise.' }));

    expect(await reply()).toBeNull();
  });

  it('ajoute le lien du formulaire prérempli après prepare_request, parenthèses encodées', async () => {
    tools.execute.mockImplementation(async (_name, _args, _ctx, run) => {
      run.requestFormUrl = '/demandes?typeId=t&text=pour+Jean+(d%C3%A9funt)';
      return { ready: true };
    });
    client.complete
      .mockResolvedValueOnce(llm({ tool_calls: [toolCall('prepare_request', { churchSlug: 'x' })] }))
      .mockResolvedValueOnce(llm({ content: 'Votre demande est prête.' }));

    const result = await reply();

    expect(result?.body).toBe(
      'Votre demande est prête.\n\n[Finaliser ma demande →](/demandes?typeId=t&text=pour+Jean+%28d%C3%A9funt%29)',
    );
  });

  it('joint à la réponse les choix posés par les tools', async () => {
    const options = [{ label: 'dim. 27 sept. · 08:00', value: 'Le dimanche 27 septembre à 08:00' }];
    tools.execute.mockImplementation(async (_name, _args, _ctx, run) => {
      run.options = options;
      return { masses: [] };
    });
    client.complete
      .mockResolvedValueOnce(llm({ tool_calls: [toolCall('get_upcoming_masses', { churchSlug: 'x' })] }))
      .mockResolvedValueOnce(llm({ content: 'Quelle messe vous convient ?' }));

    const result = await reply();

    expect(result?.options).toEqual(options);
  });
});
