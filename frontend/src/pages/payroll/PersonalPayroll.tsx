import { useState } from "react"
import { currentMonth, usePayroll } from "./payrollApi"
import {
  PayrollTotals,
  PayrollList,
  PayrollDetails,
  PayrollExports,
} from "./PayrollComponents"
import { button, control } from "../admin/adminData"
import Modal from "../../components/ui/Modal"
export default function PersonalPayroll() {
  const [month, setMonth] = useState(currentMonth),
    [key, setKey] = useState(""),
    [exportError, setExportError] = useState("")
  const { data, loading, error, reload } = usePayroll(month, "/payroll/me")
  const rows = data?.rows || [],
    detail = rows.find((r) => r.key === key)
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="font-bold text-lg">Payroll Saya</h1>
          <p className="text-sm text-slate-500 mt-1">
            Rincian gaji dan status pembayaran.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="month"
            aria-label="Periode payroll"
            className={control + " !w-auto"}
            value={month}
            onChange={(e) => {
              if (e.target.value) {
                setMonth(e.target.value)
                setKey("")
              }
            }}
          />
          <button
            className={button}
            disabled={loading}
            onClick={() => void reload()}
          >
            Muat ulang
          </button>
        </div>
      </header>
      {(error || exportError) && (
        <p className="ui-error rounded-xl p-4" role="alert">
          {error || exportError}
        </p>
      )}
      {loading ? (
        <p role="status">Memuat payroll...</p>
      ) : (
        data && (
          <>
            {!data.configured && (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                Super Admin belum menyimpan aturan periode ini.
              </p>
            )}
            <PayrollTotals rows={rows} />
            <PayrollExports
              rows={rows}
              month={month}
              onError={setExportError}
            />
            <PayrollList rows={rows} onDetail={(r) => setKey(r.key)} />
          </>
        )
      )}
      <Modal
        open={!!detail}
        onClose={() => setKey("")}
        title="Rincian Payroll Saya"
        size="lg"
      >
        {detail && (
          <div className="space-y-4">
            <PayrollDetails row={detail} />
            <PayrollExports
              rows={[detail]}
              month={month}
              onError={setExportError}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
