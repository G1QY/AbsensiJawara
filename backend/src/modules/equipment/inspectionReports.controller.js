// POST /inspection-reports/{event_id}/generate — Auto-PDF, target <3 detik.
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const supabase = require('../../config/supabaseClient');
const { s3, BUCKET_NAME } = require('../../config/s3Client');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { buildInspectionReportKey, getSignedDownloadUrl } = require('../../utils/signedUrl');
const { INSPECTION_REPORT_TARGET_MS } = require('../../config/constants');

async function generate(req, res, next) {
  const startedAt = Date.now();

  try {
    const { eventId } = req.params;

    const { data: event } = await supabase
      .from('events').select('event_name, event_code, client_name, event_date').eq('id', eventId).single();

    if (!event) return res.status(404).json({ message: 'Event tidak ditemukan.' });

    const { data: checklists } = await supabase
      .from('event_checklists').select('*, asset:equipment_assets(asset_code, asset_type)')
      .eq('event_id', eventId).order('phase', { ascending: true });

    const reportNumber = `INSP-${event.event_code}-${Date.now()}`;

    const { data: report } = await supabase
      .from('inspection_reports').insert({ event_id: eventId, report_number: reportNumber, status: 'PENDING' }).select().single();

    const pdfBuffer = await buildInspectionPdfBuffer(event, checklists, reportNumber);
    const objectKey = buildInspectionReportKey(reportNumber);

    await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey, Body: pdfBuffer, ContentType: 'application/pdf' }));

    const { data: updatedReport, error } = await supabase
      .from('inspection_reports')
      .update({ pdf_url: objectKey, status: 'GENERATED', generated_at: new Date().toISOString() })
      .eq('id', report.id).select().single();

    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    const durationMs = Date.now() - startedAt;
    if (durationMs > INSPECTION_REPORT_TARGET_MS) {
      console.warn(`[inspectionReports] Generate melebihi target ${INSPECTION_REPORT_TARGET_MS}ms (actual: ${durationMs}ms)`);
    }

    const downloadUrl = await getSignedDownloadUrl(objectKey);
    res.status(201).json({ ...updatedReport, downloadUrl, generationDurationMs: durationMs });
  } catch (err) {
    next(err);
  }
}

function buildInspectionPdfBuffer(event, checklists, reportNumber) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = new PassThrough();
    const chunks = [];

    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    doc.fontSize(16).text('Inspection Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#64748B').text(reportNumber, { align: 'center' });
    doc.moveDown(1.5);

    doc.fillColor('#000').fontSize(11);
    doc.text(`Event: ${event.event_name} (${event.event_code})`);
    doc.text(`Client: ${event.client_name || '-'}`);
    doc.text(`Tanggal Event: ${event.event_date}`);
    doc.moveDown(1);

    ['PRE_EVENT', 'POST_EVENT'].forEach((phase) => {
      doc.fontSize(13).text(phase === 'PRE_EVENT' ? 'Pre-Event Checklist (Loading)' : 'Post-Event Checklist (Unloading)');
      doc.moveDown(0.3);

      const rows = (checklists || []).filter((c) => c.phase === phase);
      if (rows.length === 0) {
        doc.fontSize(10).fillColor('#94A3B8').text('Tidak ada data.');
      } else {
        rows.forEach((c) => {
          doc.fontSize(10).fillColor('#000').text(
            `• ${c.asset?.asset_code || '-'} (${c.asset?.asset_type || '-'}) — ${c.is_present ? 'Hadir/Lengkap' : 'TIDAK ADA'}` +
            (c.damage_notes ? ` — Catatan: ${c.damage_notes}` : '')
          );
        });
      }
      doc.moveDown(1);
    });

    doc.fontSize(9).fillColor('#94A3B8').text(`Dokumen dibuat otomatis oleh sistem pada ${new Date().toLocaleString('id-ID')}.`, { align: 'center' });
    doc.end();
  });
}

module.exports = { generate };
