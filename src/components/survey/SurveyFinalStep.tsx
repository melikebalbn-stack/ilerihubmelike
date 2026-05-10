'use client'

// PR-SURVEY-UI-REFACTOR: Son bölüm — anonim toggle + isim/departman + Gönder.
//
// surveyIsAnonymous=true ise Survey ayarı zorla anonim, alanlar gizli.
// Aksi halde toggle default ON (anonim), kullanıcı isterse OFF yapıp
// kimlik bilgilerini paylaşır.

import { Send, Loader2, ShieldCheck, UserCheck } from 'lucide-react'

interface Department {
  id: string
  name: string
}

interface Props {
  surveyIsAnonymous: boolean
  departments: Department[]
  isAnonymous: boolean
  onAnonymousChange: (v: boolean) => void
  respondentName: string
  onNameChange: (v: string) => void
  respondentDepartment: string
  onDepartmentChange: (v: string) => void
  onSubmit: () => void
  submitting: boolean
}

export function SurveyFinalStep({
  surveyIsAnonymous,
  departments,
  isAnonymous,
  onAnonymousChange,
  respondentName,
  onNameChange,
  respondentDepartment,
  onDepartmentChange,
  onSubmit,
  submitting,
}: Props) {
  const showFields = !surveyIsAnonymous && !isAnonymous

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
        <h3 className="text-lg font-medium text-slate-900">Son Adım</h3>
        <p className="mt-1 text-sm text-slate-500">
          Cevaplarınızı göndermeden önce bir göz atın. İsterseniz kimliğinizi paylaşabilirsiniz.
        </p>

        {!surveyIsAnonymous && (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => onAnonymousChange(!isAnonymous)}
              className={
                'w-full flex items-center gap-3 p-4 rounded-xl border transition-all duration-150 active:scale-[0.99] ' +
                (isAnonymous
                  ? 'border-[#1B4F72] bg-[#1B4F72]/[0.06]'
                  : 'border-slate-200 bg-white hover:border-[#1B4F72]/60')
              }
            >
              <span
                className={
                  'flex-shrink-0 w-10 h-6 rounded-full relative transition-colors ' +
                  (isAnonymous ? 'bg-[#1B4F72]' : 'bg-slate-300')
                }
              >
                <span
                  className={
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ' +
                    (isAnonymous ? 'translate-x-[18px]' : 'translate-x-0.5')
                  }
                />
              </span>
              <span className="flex-1 text-left">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  {isAnonymous ? <ShieldCheck className="w-4 h-4 text-[#1B4F72]" /> : <UserCheck className="w-4 h-4 text-slate-500" />}
                  {isAnonymous ? 'Anonim olarak gönder' : 'Kimliğimle birlikte gönder'}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  {isAnonymous
                    ? 'İsim ve departman bilgileriniz kaydedilmez.'
                    : 'İsim ve departman bilgileriniz cevaplarla birlikte saklanır.'}
                </span>
              </span>
            </button>
          </div>
        )}

        {surveyIsAnonymous && (
          <div className="mt-5 flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <ShieldCheck className="w-4 h-4 text-[#1B4F72] flex-shrink-0" />
            Bu anket tamamen anonim — kimlik bilgisi toplamıyor.
          </div>
        )}

        {showFields && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                İsim Soyisim
              </label>
              <input
                type="text"
                value={respondentName}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="İsim soyisim"
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#1B4F72] focus:ring-0 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Departman
              </label>
              <select
                value={respondentDepartment}
                onChange={(e) => onDepartmentChange(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-[#1B4F72] focus:ring-0 outline-none"
              >
                <option value="">Departman seçin</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="w-full py-3.5 bg-[#1B4F72] text-white text-base font-medium rounded-xl hover:bg-[#1B4F72]/90 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Gönderiliyor...
          </>
        ) : (
          <>
            Cevapları Gönder
            <Send className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  )
}
