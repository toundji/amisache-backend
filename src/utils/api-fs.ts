// ============================================================
// UTILS — api-fs.ts
// Utilitaires système de fichiers / stockage.
// Aucune dépendance domaine — uniquement `fs` + variables d'env.
// ============================================================
import 'dotenv/config';
import {
    existsSync as fsExistsSync,
    mkdirSync as fsMkdirSync,
    rename as fsRename,
    unlink as fsUnlink,
} from 'fs';

export const defaultAvatarUrl: string | undefined = process.env.default_image_profile;

export class ApiFsUtils {

    /** Crée public/storage/<dir>/<YY> et retourne le chemin relatif. */
    static createDir(dir: string): string {
        const year = new Date().getFullYear().toString().slice(-2);
        const doc = `public/storage/${dir}/${year}`;

        if (!fsExistsSync(doc)) {
            fsMkdirSync(doc, { recursive: true });
        }
        return doc;
    }

    /** Déplace un fichier temporaire vers sa destination finale. */
    static saveFile(from: string, destination: string, context?: string): void {
        const to = destination.startsWith('./') ? destination : `./${destination}`;

        fsRename(from, to, (error) => {
            if (error) {
                console.error(
                    `Unable to move file. ${JSON.stringify({ from, to })} — ${error.message}`,
                    { stack: error.stack, context },
                );
            }
        });
    }

    /** Supprime un fichier (accepte un chemin absolu API ou relatif disque). */
    static removeFile(path: string): void {
        if (path.startsWith(process.env.API_ADDRESS ?? '')) {
            path = path.replace(process.env.API_ADDRESS ?? '', './');
        }

        fsUnlink(path, (error) => {
            if (error) console.error(error);
        });
    }

    /** Chemin disque → URL publique. */
    static pathToUrl(path: string): string {
        if (path.startsWith(process.env.API_ADDRESS ?? '')) {
            return path;
        }
        return `${process.env.API_ADDRESS}/${path}`;
    }

    /** URL publique → chemin disque relatif. */
    static urlToPath(path: string): string {
        if (path.startsWith(process.env.API_ADDRESS ?? '')) {
            const link = path.substring(process.env.API_ADDRESS?.length ?? 0);
            return `./${link}`;
        }
        return path;
    }

    static get defaultAvatar(): string {
        return `${process.env.API_ADDRESS}/public/assets/default-avatar.jpg`;
    }
}

/** Préfixe un chemin avec l'adresse publique de l'API. */
export function appHost(path: string): string {
    return `${process.env.API_ADDRESS}${path}`;
}
