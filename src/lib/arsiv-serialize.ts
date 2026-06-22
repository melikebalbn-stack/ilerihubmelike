/**
 * Arşiv modelleri (ArsivKoli, ArsivAltKoli) BigInt PK kullanır.
 * JSON.stringify BigInt'i serialize edemez (TypeError).
 *
 * Bu helper hem runtime'da BigInt → string ve Date → ISO string dönüşümünü
 * yapar, hem de tip seviyesinde dönüştürülmüş şekli yansıtır. Böylece Server
 * Component → Client Component prop pass'inde tip uyumsuzluğu olmaz.
 */

export type Serialized<T> =
  T extends bigint ? string :
  T extends Date ? string :
  T extends null | undefined ? T :
  T extends Array<infer U> ? Serialized<U>[] :
  T extends object ? { [K in keyof T]: Serialized<T[K]> } :
  T

export function toJSONSafe<T>(data: T): Serialized<T> {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  ) as Serialized<T>
}
