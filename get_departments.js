const { Client } = require("ldapts");

async function getDepartments() {
  const client = new Client({ url: "ldap://192.168.2.20:389" });
  await client.bind("svc_ilerihub@ilerigroup.com", "47YK2d8r6c");

  const { searchEntries } = await client.search("OU=ilerigroup,DC=ilerigroup,DC=com", {
    scope: "sub",
    filter: "(&(objectClass=user)(objectCategory=person)(mail=*))",
    attributes: ["cn", "department", "mail"]
  });

  const getVal = (v) => {
    if (Array.isArray(v)) return v.length > 0 ? v[0] : null;
    return v || null;
  };

  // Departmana göre grupla
  const deptUsers = {};
  searchEntries.forEach(u => {
    const dept = getVal(u.department) || "(Departman Yok)";
    const mail = getVal(u.mail);
    if (!mail) return;

    if (!deptUsers[dept]) deptUsers[dept] = [];
    deptUsers[dept].push(getVal(u.cn));
  });

  console.log("=== Departman Listesi (Email Adresi Olanlar) ===\n");

  let total = 0;
  Object.keys(deptUsers).sort((a, b) => a.localeCompare(b, "tr")).forEach((dept, i) => {
    const users = deptUsers[dept].sort((a, b) => a.localeCompare(b, "tr"));
    console.log((i + 1) + ". " + dept + " (" + users.length + " kişi)");
    users.forEach(u => console.log("   - " + u));
    console.log();
    total += users.length;
  });

  console.log("=================================");
  console.log("Toplam: " + Object.keys(deptUsers).length + " departman, " + total + " kullanıcı");

  await client.unbind();
}

getDepartments();
