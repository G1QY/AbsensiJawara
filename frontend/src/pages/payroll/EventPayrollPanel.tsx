import { useState } from "react"
import { usePayroll } from "./payrollApi"
import {
  PayrollList,
  PayrollDetails,
  PayrollExports,
} from "./PayrollComponents"
import Modal from "../../components/ui/Modal"
export default function EventPayrollPanel({
  eventId,
  month,
}: {
  eventId: string
  month: string
}) {
  const { data, loading, error } = usePayroll(
    month,
    `/payroll/event/${eventId}`,
  )
  const [key, setKey] = useState(""),
    [exportError, setExportError] = useState("")
  const rows = data?.rows || [],
    detail = rows.find((r) => r.key === key)
  return (
    <div className="space-y-4">
      {(error || exportError) && (
        <p className="ui-error p-3 rounded-xl" role="alert">
          {error || exportError}
        </p>
      )}
      {loading ? (
        <p>Memuat payroll event...</p>
      ) : (
        <>
          <PayrollExports
            rows={rows}
            month={data?.month || month}
            onError={setExportError}
          />
          <PayrollList rows={rows} onDetail={(r) => setKey(r.key)} />
        </>
      )}
      <Modal
        open={!!detail}
        onClose={() => setKey("")}
        title="Rincian Payroll Event"
        size="lg"
      >
        {detail && <PayrollDetails row={detail} />}
      </Modal>
    </div>
  )
}
