"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon, SparklesIcon, XIcon } from "lucide-react"
import { AssistantPanel } from "@/components/assistant/assistant-panel"
import { loginUrlFor, useAssistantAccess } from "@/components/assistant/assistant-provider"
import { SIZE_GUIDE_DESCRIPTION, SizeChartTable } from "@/components/product/size-guide-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getSizeAdviceAction } from "@/app/actions/size-advice"
import { nextMessageId, useAssistantUi, type FitChoice } from "@/stores/assistant-ui"
import type { AssistantActions, ChatMessage, MeasureField, MessagePart } from "@/types/assistant"

const NOT_CONNECTED =
  "Trợ lý chưa được kết nối nên mình chưa trả lời được. Bạn có thể dùng ô tìm kiếm hoặc bộ lọc ở trang sản phẩm trong lúc chờ nhé."
const OPEN_A_PRODUCT = "Bạn mở một sản phẩm rồi bấm \"Tư vấn size\", mình sẽ tính theo bảng size của đúng sản phẩm đó nhé."
const ADVICE_FAILED = "Mình chưa tính được size lúc này, bạn thử lại sau nhé."

const FIT_VALUES: FitChoice[] = ["tight", "regular", "loose"]
const isFit = (v: string): v is FitChoice => (FIT_VALUES as string[]).includes(v)

const FIT_QUESTION: MessagePart[] = [
  { type: "text", text: "Bạn thích mặc ôm hay thoải mái? Mình sẽ chọn lại cho đúng." },
  {
    type: "quickReplies",
    options: [
      { label: "Ôm", value: "tight" },
      { label: "Vừa", value: "regular" },
      { label: "Rộng", value: "loose" },
    ],
  },
]

function describe(m: Partial<Record<MeasureField, number>>): string {
  const parts = [
    m.heightCm && `cao ${m.heightCm}cm`,
    m.weightKg && `nặng ${m.weightKg}kg`,
    m.chestCm && `ngực ${m.chestCm}cm`,
    m.waistCm && `eo ${m.waistCm}cm`,
    m.hipCm && `mông ${m.hipCm}cm`,
  ].filter(Boolean)
  const text = parts.join(", ")
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Gửi số đo"
}

// Nút tròn ở góc phải dưới; bấm thì mở ô chat chữ nhật đứng ngay phía trên (mobile: toàn màn hình).
// Màu xám đen (slate-700) cho bớt nổi so với màu thương hiệu và khác màu footer (bg-ink) để không chìm khi cuộn xuống cuối trang. Tư vấn size chạy thật qua server action (tính bằng code, không LLM);
// mọi câu hỏi khác nhận lại "chưa kết nối" cho tới khi có backend AI. Đóng ô chat không xoá hội thoại.
export function AssistantWidget() {
  const { enabled, authenticated } = useAssistantAccess()
  const ui = useAssistantUi()
  const { open, setOpen, messages, push, product } = ui
  const [chartOpen, setChartOpen] = useState(false)
  const pathname = usePathname()

  // Esc thu nhỏ ô chat dù focus đang ở đâu; khi hộp thoại bảng size đang mở thì Esc để đóng hộp thoại đó trước.
  useEffect(() => {
    if (!open || chartOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, chartOpen, setOpen])

  if (!enabled) return null

  const fabClass =
    "fixed right-4 bottom-4 z-40 grid size-14 place-items-center rounded-full bg-slate-700 text-white shadow-float ring-1 ring-white/30 outline-none transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/40 sm:right-6 sm:bottom-6"

  // Khách chưa đăng nhập: nút dẫn sang trang đăng nhập rồi quay lại trang hiện tại.
  if (!authenticated) {
    return (
      <Link href={loginUrlFor(pathname)} aria-label="Đăng nhập để dùng trợ lý mua sắm" className={fabClass}>
        <SparklesIcon className="size-6" />
      </Link>
    )
  }

  const say = (role: ChatMessage["role"], parts: MessagePart[]) => push({ id: nextMessageId(), role, parts })
  const sayText = (role: ChatMessage["role"], text: string) => say(role, [{ type: "text", text }])

  async function advise(measures: Partial<Record<MeasureField, number>>, fit: FitChoice) {
    if (!product) return
    try {
      const res = await getSizeAdviceAction({ productSlug: product.slug, ...measures, fit })
      if (!res.ok) return sayText("assistant", res.message)
      ui.setChart(res.chart.length > 0 ? { rows: res.chart, categoryName: res.categoryName } : null)
      const parts: MessagePart[] = [{ type: "size", data: res.advice }]
      if (res.advice.status === "between_two" && !useAssistantUi.getState().fitChosen) parts.push(...FIT_QUESTION)
      say("assistant", parts)
    } catch {
      sayText("assistant", ADVICE_FAILED)
    }
  }

  function send(text: string) {
    sayText("user", text)
    sayText("assistant", NOT_CONNECTED)
  }

  const actions: AssistantActions = {
    onQuickReply: (value, label) => {
      sayText("user", label)
      if (isFit(value)) {
        ui.setFit(value)
        void advise(useAssistantUi.getState().measurements, value)
      } else if (value === "size") {
        sayText("assistant", OPEN_A_PRODUCT)
      } else {
        sayText("assistant", NOT_CONNECTED)
      }
    },
    onSubmitMeasurements: (values) => {
      ui.setMeasurements(values)
      sayText("user", describe(values))
      void advise(useAssistantUi.getState().measurements, useAssistantUi.getState().fit)
    },
    // Chọn size trên trang sản phẩm; ô chat vẫn mở (trên mobile ô chat phủ kín nên đóng lại để khách thấy trang).
    onSelectSize: (size) => {
      ui.requestSize(size)
      if (window.matchMedia("(max-width: 639px)").matches) setOpen(false)
    },
    onViewSizeChart: ui.chart ? () => setChartOpen(true) : undefined,
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Trợ lý mua sắm"
          className="fixed inset-0 z-50 flex animate-in flex-col overflow-hidden bg-white duration-200 fade-in-0 slide-in-from-bottom-4 sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(560px,calc(100dvh-8rem))] sm:w-[380px] sm:rounded-2xl sm:border sm:border-border sm:shadow-modal"
        >
          <header className="flex items-center gap-3 bg-ink px-4 py-3 text-white">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15">
              <SparklesIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-tight font-bold">Trợ lý mua sắm</p>
              <p className="truncate text-2xs text-white/70">
                {product ? `Đang xem: ${product.name}` : "Hỏi về size, phối đồ và chăm sóc quần áo"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Đóng trợ lý (giữ lại hội thoại)"
              onClick={() => setOpen(false)}
              className="text-white hover:bg-white/15 hover:text-white"
            >
              <XIcon />
            </Button>
          </header>
          <AssistantPanel messages={messages} onSend={send} actions={actions} />
        </div>
      )}

      {/* Trên mobile ô chat phủ kín (z-50) nên nút tròn bị che; trên máy tính nút vẫn hiện và thu nhỏ ô chat. */}
      <button
        type="button"
        aria-label={open ? "Thu nhỏ trợ lý" : "Mở trợ lý mua sắm"}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : ui.openChat())}
        className={fabClass}
      >
        {open ? <ChevronDownIcon className="size-6" /> : <SparklesIcon className="size-6" />}
      </button>

      {ui.chart && (
        <Dialog open={chartOpen} onOpenChange={setChartOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Bảng size {ui.chart.categoryName}</DialogTitle>
              <DialogDescription>{SIZE_GUIDE_DESCRIPTION}</DialogDescription>
            </DialogHeader>
            <SizeChartTable rows={ui.chart.rows} />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
