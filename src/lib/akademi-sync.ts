/**
 * Akademi User Sync Service
 *
 * IleriHub'dan Akademi LMS'e kullanici senkronizasyonu.
 * Kullanici olusturuldugunda, guncellediginde veya
 * devre disi birakildginda otomatik olarak Akademi'yi bilgilendirir.
 *
 * Sync hatasi IleriHub'daki ana islemi ASLA engellemez.
 * Tum cagrilar fire-and-forget mantiginda calisir.
 */

// IleriHub User model'inden Akademi sync formatina donusturme
interface AkademiSyncPayload {
    external_id: string;
    name: string;
    email?: string | null;
    user_type: "white_collar" | "blue_collar";
    department_name?: string | null;
    employee_id?: string | null;
    tc_no?: string | null;
    tc_last4?: string | null;
    ad_username?: string | null;
    role?: string;
    is_active?: boolean;
}

// IleriHub'dan gelen user objesi (Prisma User model'ine uyumlu)
interface IleriHubUser {
    id: string;
    name?: string | null;
    email?: string | null;
    department?: string | null;
    employeeId?: string | null;
    tcLastFour?: string | null;
    jobTitle?: string | null;
    role?: string;
    isActive?: boolean;
    // Blue collar ek alanlar
    duty?: string | null;
    section?: string | null;
}

/**
 * IleriHub role -> Akademi role donusumu
 * IleriHub'da SUPER_ADMIN, ADMIN, HR_MANAGER vb. var
 * Akademi'de sadece 'admin' ve 'user' var
 */
function mapRole(ileriHubRole?: string): string {
    if (!ileriHubRole) return "user";
    const adminRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER"];
    return adminRoles.includes(ileriHubRole) ? "admin" : "user";
}

/**
 * IleriHub user -> Akademi sync payload donusumu
 */
function toAkademiPayload(
    user: IleriHubUser,
    userType: "white_collar" | "blue_collar"
): AkademiSyncPayload {
    return {
        external_id: user.id,
        name: user.name || "Isimsiz Kullanici",
        email: user.email,
        user_type: userType,
        department_name: user.department,
        employee_id: user.employeeId,
        tc_last4: user.tcLastFour,
        role: mapRole(user.role),
        is_active: user.isActive !== false,
    };
}

/**
 * Sync ayarlarini al. Fonksiyon icinde okunur ki
 * env degiskenleri her zaman guncel olsun.
 */
function getSyncConfig(): { url: string; key: string } | null {
    const url = process.env.AKADEMI_SYNC_URL;
    const key = process.env.AKADEMI_SYNC_KEY;
    if (!url || !key) {
        console.warn("[AKADEMI SYNC] Ayarlar eksik, sync atlaniyor");
        return null;
    }
    return { url, key };
}

/**
 * Akademi'ye kullanici senkronize et (olustur veya guncelle)
 *
 * @param user - IleriHub user objesi (Prisma'dan gelen)
 * @param userType - "white_collar" veya "blue_collar"
 */
export async function syncUserToAkademi(
    user: IleriHubUser,
    userType: "white_collar" | "blue_collar" = "blue_collar"
): Promise<void> {
    try {
        const config = getSyncConfig();
        if (!config) return;

        const payload = toAkademiPayload(user, userType);

        const response = await fetch(`${config.url}/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-sync-api-key": config.key,
                "x-sync-source": "ilerihub",
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("[AKADEMI SYNC] Hata:", result);
        } else {
            console.log(
                "[AKADEMI SYNC]",
                result.action,
                ":",
                user.name,
                "(external_id:",
                user.id,
                ")"
            );
        }
    } catch (err) {
        // Sync hatasi ana islemi ENGELLEMEZ
        console.error(
            "[AKADEMI SYNC] Baglanti hatasi:",
            err instanceof Error ? err.message : err
        );
    }
}

/**
 * Akademi'de kullaniciyi devre disi birak
 *
 * @param userId - IleriHub'daki user ID (cuid)
 * @param userName - Loglama icin kullanici adi
 */
export async function deactivateUserInAkademi(
    userId: string,
    userName?: string
): Promise<void> {
    try {
        const config = getSyncConfig();
        if (!config) return;

        const response = await fetch(`${config.url}/users/${userId}`, {
            method: "DELETE",
            headers: {
                "x-sync-api-key": config.key,
                "x-sync-source": "ilerihub",
            },
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("[AKADEMI SYNC] Deactivate hata:", result);
        } else {
            console.log(
                "[AKADEMI SYNC] Deactivated:",
                userName || userId
            );
        }
    } catch (err) {
        console.error(
            "[AKADEMI SYNC] Baglanti hatasi:",
            err instanceof Error ? err.message : err
        );
    }
}

/**
 * Toplu senkronizasyon (ilk kurulum veya periyodik tam sync icin)
 *
 * @param users - IleriHub user listesi
 * @param userType - Tumu ayni tip ise
 * @param deactivateMissing - Listede olmayanlari devre disi birak
 */
export async function bulkSyncToAkademi(
    users: IleriHubUser[],
    userType: "white_collar" | "blue_collar" = "blue_collar",
    deactivateMissing: boolean = false
): Promise<void> {
    try {
        const config = getSyncConfig();
        if (!config) return;

        const payload = {
            users: users.map((u) => toAkademiPayload(u, userType)),
            deactivate_missing: deactivateMissing,
        };

        const response = await fetch(`${config.url}/users/bulk`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-sync-api-key": config.key,
                "x-sync-source": "ilerihub",
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("[AKADEMI SYNC] Bulk hata:", result);
        } else {
            console.log(
                "[AKADEMI SYNC] Bulk sync:",
                result.created, "olusturuldu,",
                result.updated, "guncellendi,",
                result.deactivated, "devre disi"
            );
        }
    } catch (err) {
        console.error(
            "[AKADEMI SYNC] Baglanti hatasi:",
            err instanceof Error ? err.message : err
        );
    }
}
