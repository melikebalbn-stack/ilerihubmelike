import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useState } from "react"
import { MesajGirisiFormu } from "./MesajGirisiFormu"

// rAF'i senkron çalıştır (test ortamında focus'u hemen uygulasın)
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0 })
})

// Gerçek akışı taklit: gönderirken gonderiliyor=true → input disabled → sonra false.
function Harness() {
  const [value, setValue] = useState("merhaba")
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const onGonder = async () => {
    setGonderiliyor(true)
    await Promise.resolve()
    setValue("")
    setGonderiliyor(false)
  }
  return <MesajGirisiFormu value={value} onChange={setValue} onGonder={onGonder} gonderiliyor={gonderiliyor} />
}

describe("MesajGirisiFormu — Enter sonrası focus korunur", () => {
  it("Enter ile gönderim sonrası activeElement input", async () => {
    render(<Harness />)
    const input = screen.getByPlaceholderText("Mesajinizi yazin...") as HTMLInputElement
    input.focus()
    expect(document.activeElement).toBe(input)

    // Enter → form submit → gonderiliyor true→false döngüsü
    await act(async () => {
      fireEvent.submit(input.closest("form")!)
      await Promise.resolve()
    })

    // gonderiliyor false olunca useEffect + rAF focus'u geri verir
    expect(document.activeElement).toBe(input)
  })

  it("gönderiliyor iken input disabled, boşken buton disabled", () => {
    const { rerender } = render(
      <MesajGirisiFormu value="x" onChange={() => {}} onGonder={() => {}} gonderiliyor={true} />
    )
    expect((screen.getByPlaceholderText("Mesajinizi yazin...") as HTMLInputElement).disabled).toBe(true)
    rerender(<MesajGirisiFormu value="" onChange={() => {}} onGonder={() => {}} gonderiliyor={false} />)
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true) // boş → gönderilemez
  })
})
