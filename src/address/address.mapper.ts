// ============================================================
// AMISACHE — address.mapper.ts
// Convertit l'AddressDto reçu en HTTP (lat/lng nommés) vers l'objet-
// valeur Address (location: Point GeoJSON). Réutilisable par toute
// entité hôte qui embarque Address (aujourd'hui Church uniquement).
// ============================================================
import { Address } from './entities/address.embeddable';
import { AddressDto } from './dto/address.dto';

export function toAddressEntity(dto: AddressDto): Address {
  const address = new Address();
  address.locality = dto.locality;
  address.landmark = dto.landmark;
  address.zoneId = dto.zoneId;
  address.villageId = dto.villageId;
  if (dto.location) {
    address.location = {
      type: 'Point',
      coordinates: [dto.location.lng, dto.location.lat],
    };
  }
  return address;
}
