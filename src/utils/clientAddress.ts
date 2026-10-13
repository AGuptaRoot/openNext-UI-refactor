import type { ClientAddress, ClientItem } from '../types/clients';

function partsFromAddress(addr?: ClientAddress | null): string {
  if (!addr || typeof addr !== 'object') return '';
  return [addr.street, addr.city, addr.state, addr.zip, addr.country]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Clients store location on billingAddress / addresses / city+state —
 * not a flat `address` string. Build a single display line for lists.
 */
export function formatClientAddressLine(
  client: Pick<
    ClientItem,
    'address' | 'city' | 'state' | 'country' | 'billingAddress' | 'shippingAddress' | 'addresses'
  >
): string {
  const flat = String(client.address || '').trim();
  if (flat) return flat;

  const billing = partsFromAddress(client.billingAddress);
  if (billing) return billing;

  const preferred =
    client.addresses?.find((row) => row.isDefault) ||
    client.addresses?.find((row) => row.type === 'billing') ||
    client.addresses?.[0];
  const fromList = partsFromAddress(preferred);
  if (fromList) return fromList;

  const shipping = partsFromAddress(client.shippingAddress);
  if (shipping) return shipping;

  return [client.city, client.state, client.country]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}
