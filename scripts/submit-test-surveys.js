const surveyId = 'cm5psurvey002';
const baseUrl = 'http://localhost:3000';

// 5 farklı profil için yanıtlar
const profiles = [
  { name: 'Çok Memnun', bias: 'positive' },
  { name: 'Memnun', bias: 'mostly_positive' },
  { name: 'Kararsız', bias: 'neutral' },
  { name: 'Memnun Değil', bias: 'mostly_negative' },
  { name: 'Hiç Memnun Değil', bias: 'negative' }
];

async function submitSurvey(profile) {
  const surveyRes = await fetch(`${baseUrl}/api/public/survey/${surveyId}`);
  const survey = await surveyRes.json();

  if (!survey.questions) {
    console.error('Anket bulunamadı:', survey.error);
    return;
  }

  const answers = {};

  survey.questions.forEach(q => {
    if (q.questionType === 'SINGLE_CHOICE' && q.options.length > 0) {
      const sortedOptions = q.options.sort((a, b) => a.sortOrder - b.sortOrder);

      // Demografik sorular için rastgele seç
      const isDemographic = q.id === 'q054' || q.id === 'q055' || q.id === 'q056' || q.id === 'q057';

      if (isDemographic) {
        // Demografik sorularda rastgele bir seçenek seç
        const randomIdx = Math.floor(Math.random() * sortedOptions.length);
        answers[q.id] = sortedOptions[randomIdx].id;
      } else {
        // Normal sorular için bias'a göre seç
        let selectedOption;
        const rand = Math.random();

        switch(profile.bias) {
          case 'positive':
            if (rand < 0.8) selectedOption = sortedOptions[0];
            else if (rand < 0.9) selectedOption = sortedOptions[2];
            else selectedOption = sortedOptions[1];
            break;
          case 'mostly_positive':
            if (rand < 0.6) selectedOption = sortedOptions[0];
            else if (rand < 0.85) selectedOption = sortedOptions[2];
            else selectedOption = sortedOptions[1];
            break;
          case 'neutral':
            if (rand < 0.3) selectedOption = sortedOptions[0];
            else if (rand < 0.8) selectedOption = sortedOptions[2];
            else selectedOption = sortedOptions[1];
            break;
          case 'mostly_negative':
            if (rand < 0.2) selectedOption = sortedOptions[0];
            else if (rand < 0.45) selectedOption = sortedOptions[2];
            else selectedOption = sortedOptions[1];
            break;
          case 'negative':
            if (rand < 0.1) selectedOption = sortedOptions[0];
            else if (rand < 0.25) selectedOption = sortedOptions[2];
            else selectedOption = sortedOptions[1];
            break;
        }

        if (selectedOption) {
          answers[q.id] = selectedOption.id;
        }
      }
    } else if (q.questionType === 'TEXT_LONG') {
      answers[q.id] = profile.name + ' profili - Test yanıtı';
    }
  });

  const submitRes = await fetch(`${baseUrl}/api/public/survey/${surveyId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  });

  const result = await submitRes.json();
  console.log(profile.name + ': ' + (result.success ? 'Başarılı' : result.error));
}

async function main() {
  for (const profile of profiles) {
    await submitSurvey(profile);
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('Tüm anketler gönderildi!');
}

main().catch(console.error);
