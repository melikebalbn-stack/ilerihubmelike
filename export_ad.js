const { Client } = require("ldapts");
const fs = require("fs");

async function exportAll() {
  const client = new Client({ url: "ldap://192.168.2.20:389" });
  await client.bind("svc_ilerihub@ilerigroup.com", "47YK2d8r6c");

  const { searchEntries } = await client.search("OU=ilerigroup,DC=ilerigroup,DC=com", {
    scope: "sub",
    filter: "(&(objectClass=user)(objectCategory=person))",
    attributes: ["cn", "sAMAccountName", "mail", "department", "title", "distinguishedName"]
  });

  const getVal = (v) => {
    if (Array.isArray(v)) return v.length > 0 ? v[0] : "";
    return v || "";
  };

  const getOU = (dn) => {
    const match = dn.match(/OU=([^,]+)/g);
    if (match) {
      return match.map(m => m.replace("OU=", "")).reverse().join(" > ");
    }
    return "";
  };

  let csv = "OU Yolu;Ad Soyad;Kullanici Adi;E-posta;Departman;Unvan\n";

  const sorted = searchEntries.sort((a, b) => {
    const ouA = getOU(a.distinguishedName);
    const ouB = getOU(b.distinguishedName);
    if (ouA !== ouB) return ouA.localeCompare(ouB, "tr");
    return getVal(a.cn).localeCompare(getVal(b.cn), "tr");
  });

  sorted.forEach(u => {
    const ou = getOU(u.distinguishedName);
    const cn = getVal(u.cn);
    const sam = getVal(u.sAMAccountName);
    const mail = getVal(u.mail);
    const dept = getVal(u.department);
    const title = getVal(u.title);

    csv += ou + ";" + cn + ";" + sam + ";" + mail + ";" + dept + ";" + title + "\n";
  });

  fs.writeFileSync("/home/rokunet/projects/ilerihub/public/ad_tum_kullanicilar.csv", csv, "utf8");

  console.log("Toplam:", searchEntries.length, "kullanici");
  console.log("Dosya: http://172.16.16.33:3000/ad_tum_kullanicilar.csv");

  const ouStats = {};
  sorted.forEach(u => {
    const parts = getOU(u.distinguishedName).split(" > ");
    const ou = parts[1] || parts[0] || "Root";
    ouStats[ou] = (ouStats[ou] || 0) + 1;
  });

  console.log("\n=== OU Bazli Dagilim ===");
  Object.entries(ouStats).sort((a,b) => b[1] - a[1]).forEach(([ou, count]) => {
    console.log(ou + ": " + count);
  });

  await client.unbind();
}

exportAll();
