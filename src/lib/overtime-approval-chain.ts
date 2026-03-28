export const APPROVAL_CHAIN = [
  { step: 1, role: "Üretim Müdür Yardımcısı", position: "PRODUCTION_DEPUTY" },
  { step: 2, role: "Fabrika Müdürü", position: "FACTORY_MANAGER" },
  { step: 3, role: "T. Planlama Müdürü", position: "PLANNING_MANAGER" },
  { step: 4, role: "Kalite Müdürü", position: "QUALITY_MANAGER" },
  { step: 5, role: "İ.V. Müdürü", position: "HR_MANAGER" },
  { step: 6, role: "Genel Müdür Yardımcısı", position: "DEPUTY_GM" },
  { step: 7, role: "Genel Müdür", position: "GM", optional: true },
] as const

export type ApprovalStep = typeof APPROVAL_CHAIN[number]

// Onay akışı: Her onaylayan onayladığında currentStep +1 artar.
// Eğer sendToGM false ise step 6'dan sonra form APPROVED olur.
// Eğer sendToGM true ise (GMY tarafından ayarlanır) step 7'ye gider.
// Herhangi birisi reddederse form REJECTED olur.

export function getMaxSteps(sendToGM: boolean): number {
  return sendToGM ? 7 : 6
}

export function isFormFullyApproved(currentStep: number, sendToGM: boolean): boolean {
  return currentStep >= getMaxSteps(sendToGM)
}

export function getCurrentApprovalStep(currentStep: number): typeof APPROVAL_CHAIN[number] | undefined {
  return APPROVAL_CHAIN.find(a => a.step === currentStep + 1)
}
