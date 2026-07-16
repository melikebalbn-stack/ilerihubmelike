"use client"

// Vardiya Faz 1: mesai new-form çekirdeği OvertimeFormNew'e taşındı. Bu sayfa
// MESAI tipiyle onu render eder (davranış aynen korunur — kod ikilemesi yok).
import OvertimeFormNew from "@/components/overtime/OvertimeFormNew"

export default function NewOvertimeFormPage() {
  return <OvertimeFormNew formTipi="MESAI" />
}
