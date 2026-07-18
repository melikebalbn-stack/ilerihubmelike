# infra — altyapı dosyalarının repo kopyası

Bu klasördeki dosyalar **canlıda çalışan kopyalar değildir**; sürüm takibi ve
gözden geçirme için tutulan referans/yedeklerdir.

## ecosystem.config.js

- **Canlı dosya:** `/home/rokunet/projects/ecosystem.config.js`
- Buradaki `infra/ecosystem.config.js` **referans/yedek** kopyadır.
- **Değişiklik önce canlıda yapılır**, PM2 ile devreye alınır, sonra buraya
  senkronlanır (`cp /home/rokunet/projects/ecosystem.config.js infra/`).
- `deploy.sh` build öncesi iki dosyayı karşılaştırır; farklıysa **uyarı basar**
  (deploy'u durdurmaz) — kopyanın bayatladığını hatırlatmak için.

PM2 uygulamaları: `ilerihub-blue` (3000), `ilerihub-green` (3002),
`ilerihub-staging` (3001). Her biri `NODE_EXTRA_CA_CERTS` ile IFS ara
sertifikasını (RapidSSL TLS RSA CA G1) Node'a tanıtır — Node sistem CA
deposunu okumadığı için bu şarttır.

> Secret içermez; IFS kimlik bilgileri slot'ların `.env.local` dosyalarındadır
> ve **repoya girmez**.
