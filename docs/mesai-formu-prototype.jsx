import { useState } from "react";

const BOLUMLER = [
  "KAYNAKHANE", "LAZER", "CNC", "PAKET", "MONTAJ", "TALAŞLI İMALAT",
  "BOYA", "KALİTE KONTROL", "DEPO", "BAKIM", "ÜRETİM PLANLAMA"
];

const SERVIS_GUZERGAHLARI = [
  "BELEDİYE", "BATTI ÇIKTI", "ADEM YAVUZ KAPALI PAZAR (TRAFO)",
  "GEBZE", "DARICA", "DİLOVASI"
];

const ONAY_SIRASI = [
  { unvan: "Üretim Müdür Yardımcısı", isim: "BEDRİ GÜLER", zorunlu: true },
  { unvan: "Fabrika Müdürü", isim: "SAMET TAŞLI", zorunlu: true },
  { unvan: "T. Planlama Müdürü", isim: "ORKUN KIRÇUVALOĞLU", zorunlu: true },
  { unvan: "Kalite Müdürü", isim: "SAMİ TEKOĞLU", zorunlu: true },
  { unvan: "İ.V. Müdürü", isim: "ELİF KASAR", zorunlu: true },
  { unvan: "Genel Müdür Yardımcısı", isim: "GÜRHAN HORBAY", zorunlu: true },
  { unvan: "Genel Müdür", isim: "HALİT İLERİ", zorunlu: false },
];

const MESAI_TURLERI = [
  { value: "cumartesi", label: "Cumartesi Mesaisi", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "pazar", label: "Pazar Mesaisi", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "hafta_ici", label: "Hafta İçi Fazla Mesai", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "resmi_tatil", label: "Resmi Tatil Mesaisi", color: "bg-red-100 text-red-800 border-red-200" },
];

const ORNEK_PERSONELLER = [
  { id: 1, ad: "MURAT TINGIR", sicil: "ILR-00120", bolum: "KAYNAKHANE", yaka: "mavi", tel: "(533)-740-3317", servis: "BELEDİYE" },
  { id: 2, ad: "ZENNUR TÜRKOĞLU", sicil: "ILR-00134", bolum: "KAYNAKHANE", yaka: "mavi", tel: "(530)-445-2211", servis: "BATTI ÇIKTI" },
  { id: 3, ad: "ÖZEL ÇAMSOY", sicil: "ILR-00155", bolum: "LAZER", yaka: "mavi", tel: "(533)-740-3317", servis: "BATTI ÇIKTI" },
  { id: 4, ad: "AHMET YAĞIYANIK", sicil: "ILR-00282", bolum: "CNC", yaka: "mavi", tel: "(537)-340-0110", servis: "ADEM YAVUZ KAPALI PAZAR (TRAFO)" },
  { id: 5, ad: "MUSTAFA ÇEVİK", sicil: "ILR-00661", bolum: "CNC", yaka: "mavi", tel: "(530)-770-0050", servis: "BELEDİYE" },
  { id: 6, ad: "İSA ÇELİK", sicil: "ILR-00761", bolum: "PAKET", yaka: "mavi", tel: "(555)-598-9790", servis: "BELEDİYE" },
  { id: 7, ad: "MELİH YILMAZ", sicil: "ILR-00301", bolum: "BİLGİ TEKNOLOJİLERİ", yaka: "beyaz", tel: "(532)-111-2233", servis: "" },
];

export default function MesaiFormu() {
  const [mesaiTuru, setMesaiTuruState] = useState("cumartesi");
  const setMesaiTuru = (tur) => {
    setMesaiTuruState(tur);
    if (tur === "hafta_ici") {
      setTamGun(false);
      setBaslangicSaat("17:00");
      setBitisSaat("20:30");
    } else {
      setTamGun(true);
    }
  };
  const [tarih, setTarih] = useState("2026-01-26");
  const [tamGun, setTamGun] = useState(true);
  const [baslangicSaat, setBaslangicSaat] = useState("08:00");
  const [bitisSaat, setBitisSaat] = useState("17:00");
  const [yakaFiltre, setYakaFiltre] = useState("hepsi");
  const [bolumFiltre, setBolumFiltre] = useState("");
  const [aramaText, setAramaText] = useState("");
  const [seciliPersoneller, setSeciliPersoneller] = useState([]);
  const [personelDetaylar, setPersonelDetaylar] = useState({});
  const [adim, setAdim] = useState(1);
  const [gmGonder, setGmGonder] = useState(false);

  const gun = new Date(tarih).toLocaleDateString("tr-TR", { weekday: "long" });
  const tarihFormatli = new Date(tarih).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });

  const filtrelenmisPersoneller = ORNEK_PERSONELLER.filter(p => {
    if (yakaFiltre !== "hepsi" && p.yaka !== yakaFiltre) return false;
    if (bolumFiltre && p.bolum !== bolumFiltre) return false;
    if (aramaText && !p.ad.toLowerCase().includes(aramaText.toLowerCase()) && !p.sicil.toLowerCase().includes(aramaText.toLowerCase())) return false;
    return true;
  });

  const personelSec = (personel) => {
    if (seciliPersoneller.find(p => p.id === personel.id)) {
      setSeciliPersoneller(seciliPersoneller.filter(p => p.id !== personel.id));
      const yeniDetaylar = { ...personelDetaylar };
      delete yeniDetaylar[personel.id];
      setPersonelDetaylar(yeniDetaylar);
    } else {
      setSeciliPersoneller([...seciliPersoneller, personel]);
      setPersonelDetaylar({
        ...personelDetaylar,
        [personel.id]: {
          mesaiYapacakBolum: personel.bolum,
          hedef: "",
          hedefUretimMiktari: "",
          servisGuzergahi: personel.servis || "",
        }
      });
    }
  };

  const detayGuncelle = (personelId, alan, deger) => {
    setPersonelDetaylar({
      ...personelDetaylar,
      [personelId]: {
        ...personelDetaylar[personelId],
        [alan]: deger
      }
    });
  };

  const mesaiTuruBilgi = MESAI_TURLERI.find(m => m.value === mesaiTuru);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">İ</div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">MESAİ FORMU</h1>
                <p className="text-sm text-gray-500">İleri Group - Fazla Mesai Talep Sistemi</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[1,2,3].map(s => (
                <div key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${adim >= s ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-400'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${adim >= s ? 'bg-teal-600 text-white' : 'bg-gray-300 text-white'}`}>{s}</span>
                  {s === 1 ? 'Bilgiler' : s === 2 ? 'Personel' : 'Önizleme'}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Adım 1: Mesai Bilgileri */}
        {adim === 1 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Mesai Bilgileri</h2>

            {/* Kaizen Box */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 mb-6">
              <p className="text-sm text-blue-700">
                <span className="font-medium">💡 Bilgi:</span> Mesai formunu doldurmadan önce mesai türünü, tarihini ve saatlerini belirleyin. Sonraki adımda personel seçimi yapacaksınız.
              </p>
            </div>

            {/* Mesai Türü Seçimi */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mesai Türü</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MESAI_TURLERI.map(tur => (
                  <button
                    key={tur.value}
                    onClick={() => setMesaiTuru(tur.value)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      mesaiTuru === tur.value
                        ? tur.color + ' border-current ring-2 ring-offset-1 ring-current/30'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {tur.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tarih ve Saat */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                <input
                  type="date"
                  value={tarih}
                  onChange={e => setTarih(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="text-xs text-gray-500 mt-1">{tarihFormatli}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Çalışma Şekli</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTamGun(true)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${tamGun ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-gray-300 text-gray-600'}`}
                  >
                    Tam Gün
                  </button>
                  <button
                    onClick={() => setTamGun(false)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${!tamGun ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-gray-300 text-gray-600'}`}
                  >
                    Saat Aralığı
                  </button>
                </div>
              </div>
              {!tamGun && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
                    <input
                      type="time"
                      value={baslangicSaat}
                      onChange={e => setBaslangicSaat(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
                    <input
                      type="time"
                      value={bitisSaat}
                      onChange={e => setBitisSaat(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Açıklama */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama (Opsiyonel)</label>
              <textarea
                placeholder="Mesai ile ilgili genel açıklama..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setAdim(2)}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                Personel Seçimine Geç →
              </button>
            </div>
          </div>
        )}

        {/* Adım 2: Personel Seçimi */}
        {adim === 2 && (
          <div className="space-y-6">
            {/* Üst Bilgi Kartı */}
            <div className={`rounded-lg border p-3 ${mesaiTuruBilgi.color}`}>
              <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
                <span className="font-medium">{mesaiTuruBilgi.label}</span>
                <span>{tarihFormatli}</span>
                <span>{tamGun ? 'Tam Gün' : `${baslangicSaat} - ${bitisSaat}`}</span>
                <button onClick={() => setAdim(1)} className="underline text-xs opacity-70 hover:opacity-100">Değiştir</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Sol: Personel Listesi */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-5">
                <h3 className="text-base font-semibold text-gray-900 mb-3">👥 Personel Seçimi</h3>

                {/* Filtreler */}
                <div className="space-y-3 mb-4">
                  <input
                    type="text"
                    placeholder="İsim veya sicil no ile ara..."
                    value={aramaText}
                    onChange={e => setAramaText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="flex gap-2">
                    {["hepsi","mavi","beyaz"].map(y => (
                      <button
                        key={y}
                        onClick={() => setYakaFiltre(y)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          yakaFiltre === y
                            ? y === 'mavi' ? 'bg-blue-100 border-blue-300 text-blue-800'
                              : y === 'beyaz' ? 'bg-gray-100 border-gray-300 text-gray-800'
                              : 'bg-teal-100 border-teal-300 text-teal-800'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {y === 'hepsi' ? '👥 Hepsi' : y === 'mavi' ? '🔵 Mavi Yaka' : '⚪ Beyaz Yaka'}
                      </button>
                    ))}
                  </div>
                  <select
                    value={bolumFiltre}
                    onChange={e => setBolumFiltre(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Tüm Bölümler</option>
                    {BOLUMLER.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* Personel Listesi */}
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {filtrelenmisPersoneller.map(p => {
                    const secili = seciliPersoneller.find(s => s.id === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => personelSec(p)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all text-sm ${
                          secili
                            ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-200'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-900">{p.ad}</span>
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${p.yaka === 'mavi' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                              {p.yaka === 'mavi' ? 'M' : 'B'}
                            </span>
                          </div>
                          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${secili ? 'bg-teal-600 border-teal-600 text-white' : 'border-gray-300'}`}>
                            {secili ? '✓' : ''}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.sicil} · {p.bolum}</div>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs text-gray-500 text-center">
                  {filtrelenmisPersoneller.length} personel · {seciliPersoneller.length} seçili
                </div>
              </div>

              {/* Sağ: Seçili Personel Detayları */}
              <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border p-5">
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  📋 Seçili Personel ({seciliPersoneller.length})
                </h3>

                {seciliPersoneller.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-2">👈</p>
                    <p className="text-sm">Soldaki listeden personel seçin</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {seciliPersoneller.map(p => {
                      const detay = personelDetaylar[p.id] || {};
                      return (
                        <div key={p.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium text-sm text-gray-900">{p.ad}</span>
                              <span className="text-xs text-gray-500 ml-2">{p.sicil} · {p.bolum}</span>
                            </div>
                            <button
                              onClick={() => personelSec(p)}
                              className="text-red-400 hover:text-red-600 text-xs"
                            >✕ Kaldır</button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <div>
                              <label className="text-xs text-gray-500">Mesai Yapacak Bölüm</label>
                              <select
                                value={detay.mesaiYapacakBolum || p.bolum}
                                onChange={e => detayGuncelle(p.id, 'mesaiYapacakBolum', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                              >
                                {BOLUMLER.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                            {p.yaka === 'mavi' && (
                              <div>
                                <label className="text-xs text-gray-500">Servis Güzergahı</label>
                                <select
                                  value={detay.servisGuzergahi || ''}
                                  onChange={e => detayGuncelle(p.id, 'servisGuzergahi', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                                >
                                  <option value="">Seçiniz...</option>
                                  {SERVIS_GUZERGAHLARI.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                            )}
                            <div>
                              <label className="text-xs text-gray-500">Hedef Üretim</label>
                              <input
                                type="text"
                                placeholder="Ör: KR09-8041-8042"
                                value={detay.hedef || ''}
                                onChange={e => detayGuncelle(p.id, 'hedef', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Gerçekleşen Üretim</label>
                              <input
                                type="number"
                                placeholder="Ör: 150"
                                value={detay.hedefUretimMiktari || ''}
                                onChange={e => detayGuncelle(p.id, 'hedefUretimMiktari', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {seciliPersoneller.length > 0 && (
                  <div className="flex justify-between mt-4 pt-4 border-t">
                    <button onClick={() => setAdim(1)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">← Geri</button>
                    <button
                      onClick={() => setAdim(3)}
                      className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                    >
                      Önizleme →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Adım 3: Önizleme ve Onay Akışı */}
        {adim === 3 && (
          <div className="space-y-6">
            {/* Form Önizleme */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold">MESAİ FORMU</h2>
                    <p className="text-teal-100 text-sm mt-0.5">İleri Group</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{mesaiTuruBilgi.label}</p>
                    <p className="text-teal-100">{tarihFormatli}</p>
                    <p className="text-teal-100">{tamGun ? 'Tam Gün' : `${baslangicSaat} - ${bitisSaat}`}</p>
                  </div>
                </div>
              </div>

              {/* Tablo */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Mesai Yapacak Bölüm</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Personel Adı</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Sicil No</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Tel No</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Servis Güzergahı</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Personel Bölümü</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Hedef Üretim</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Gerçekleşen Üretim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seciliPersoneller.map((p, i) => {
                      const detay = personelDetaylar[p.id] || {};
                      return (
                        <tr key={p.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2 font-medium">{detay.mesaiYapacakBolum || p.bolum}</td>
                          <td className="px-4 py-2 font-medium">{p.ad}</td>
                          <td className="px-4 py-2 text-gray-600">{p.sicil}</td>
                          <td className="px-4 py-2 text-gray-600">{p.tel}</td>
                          <td className="px-4 py-2 text-gray-600">{detay.servisGuzergahi || '-'}</td>
                          <td className="px-4 py-2 text-gray-600">{p.bolum}</td>
                          <td className="px-4 py-2 text-gray-600">{detay.hedef || '-'}</td>
                          <td className="px-4 py-2 text-gray-600">{detay.hedefUretimMiktari || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Onay Akışı */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4">✅ Onay Akışı</h3>

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 mb-4">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">⚡ Bilgi:</span> Form gönderildiğinde aşağıdaki sıraya göre onay sürecine girer. Her onaylayan bir sonrakine iletir.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {ONAY_SIRASI.map((onay, i) => {
                  const isGM = onay.unvan === "Genel Müdür";
                  if (isGM && !gmGonder) return null;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      {i > 0 && <span className="text-gray-300 text-lg">→</span>}
                      <div className={`px-3 py-2 rounded-lg border text-xs ${
                        isGM
                          ? 'border-dashed border-gray-300 bg-gray-50 text-gray-500'
                          : 'border-teal-200 bg-teal-50 text-teal-800'
                      }`}>
                        <p className="font-medium">{onay.unvan}</p>
                        {onay.isim && <p className="text-xs opacity-75">{onay.isim}</p>}
                        {isGM && <p className="text-xs italic">(Opsiyonel)</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="flex items-center gap-2 mt-4 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gmGonder}
                  onChange={e => setGmGonder(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                Genel Müdür onayına da gönder
              </label>
            </div>

            {/* Butonlar */}
            <div className="flex justify-between">
              <button onClick={() => setAdim(2)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">← Personel Düzenle</button>
              <div className="flex gap-3">
                <button className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Taslak Kaydet
                </button>
                <button className="px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700">
                  Onaya Gönder ✓
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
