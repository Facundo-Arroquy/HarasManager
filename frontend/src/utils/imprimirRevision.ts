import { formatFecha } from './fecha'

export interface RevisionData {
  caballo: {
    nombre: string
    categoria?: string | null
    fecha_nacimiento?: string | null
    numero_chip?: string | null
    numero_registro?: string | null
    cat_raza?: { nombre: string } | null
    cat_pelaje?: { nombre: string } | null
    marca?: { nombre: string } | null
  }
  fecha: string              // YYYY-MM-DD
  firmante: string           // nombre del veterinario
  email: string
  comprador?: string
  items: Array<{
    categoria: string
    hallazgo: string
    resultado: 'normal' | 'anormal' | 'a_observar'
  }>
  conclusion: string
  dictamen: 'apto' | 'no_apto' | 'condicionado'
}

const RES_LABEL: Record<string, string> = {
  normal:     'Normal',
  anormal:    'Anormal',
  a_observar: 'A observar',
}
const RES_COLOR: Record<string, string> = {
  normal:     '#16a34a',
  anormal:    '#dc2626',
  a_observar: '#d97706',
}
const DIC_LABEL: Record<string, string> = {
  apto:        'APTO PARA LA VENTA',
  no_apto:     'NO APTO PARA LA VENTA',
  condicionado: 'APTO CON OBSERVACIONES',
}
const DIC_COLOR: Record<string, string> = {
  apto:        '#16a34a',
  no_apto:     '#dc2626',
  condicionado: '#d97706',
}

export function imprimirRevision(data: RevisionData) {
  const win = window.open('', '_blank', 'width=900,height=1200')
  if (!win) {
    alert('No se pudo abrir la ventana de impresión. Habilitá las ventanas emergentes en tu navegador.')
    return
  }

  const filas = data.items.map((it) => `
    <tr>
      <td class="td">${it.categoria}</td>
      <td class="td">${it.hallazgo || '<span style="color:#9ca3af">—</span>'}</td>
      <td class="td res" style="color:${RES_COLOR[it.resultado]}">${RES_LABEL[it.resultado]}</td>
    </tr>
  `).join('')

  const dicColor = DIC_COLOR[data.dictamen]

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Revisión Pre-Venta — ${data.caballo.nombre}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10pt;color:#111;background:#fff}
    .page{max-width:210mm;margin:0 auto;padding:16mm 20mm}

    /* ── Header ── */
    .hdr{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:12px;margin-bottom:20px;border-bottom:2.5px solid #111}
    .hdr-logo{display:flex;align-items:center;gap:10px}
    .hdr-circle{width:32px;height:32px;border-radius:50%;background:#065f46;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14pt;font-weight:700;flex-shrink:0}
    .hdr-title{font-size:17pt;font-weight:700;line-height:1.1}
    .hdr-sub{font-size:8.5pt;color:#6b7280;margin-top:2px}
    .hdr-date{text-align:right;font-size:9pt;color:#6b7280}

    /* ── Section titles ── */
    .stitle{font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#6b7280;margin:18px 0 7px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}

    /* ── Info grid ── */
    .igrid{display:grid;grid-template-columns:1fr 1fr;gap:5px 16px}
    .irow{display:flex;gap:6px;font-size:9.5pt;align-items:baseline}
    .ilbl{color:#9ca3af;min-width:76px;flex-shrink:0}
    .ival{font-weight:600}

    /* ── Table ── */
    table{width:100%;border-collapse:collapse;font-size:9.5pt}
    th{text-align:left;padding:6px 8px;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:#f3f4f6;border-bottom:1.5px solid #d1d5db}
    .td{padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
    tr:last-child .td{border-bottom:none}
    tr:nth-child(even){background:#fafafa}
    .res{font-weight:600}

    /* ── Conclusión ── */
    .cbox{background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:10px;font-size:9.5pt;min-height:56px;line-height:1.5}

    /* ── Dictamen ── */
    .dic-wrap{margin-top:14px}
    .dic{display:inline-block;padding:10px 22px;border-radius:5px;font-size:12pt;font-weight:700;letter-spacing:.02em;border-width:2px;border-style:solid}

    /* ── Firma ── */
    .firma-sec{margin-top:40px;display:flex;justify-content:flex-end}
    .firma-box{text-align:center;width:200px}
    .firma-line{border-top:1.5px solid #111;margin-bottom:6px}
    .firma-name{font-size:9pt;font-weight:700}
    .firma-sub{font-size:8pt;color:#6b7280}

    /* ── Footer ── */
    .footer{margin-top:28px;padding-top:6px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af}

    @media print{
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .page{padding:8mm 14mm}
      @page{size:A4;margin:8mm}
    }
  </style>
</head>
<body>
<div class="page">

  <div class="hdr">
    <div class="hdr-logo">
      <div class="hdr-circle">H</div>
      <div>
        <div class="hdr-title">Revisión Pre-Venta</div>
        <div class="hdr-sub">Certificado de revisión clínica para compraventa de equino — HarasManager</div>
      </div>
    </div>
    <div class="hdr-date">${formatFecha(data.fecha)}</div>
  </div>

  <div class="stitle">Datos del animal</div>
  <div class="igrid">
    <div class="irow"><span class="ilbl">Nombre:</span><span class="ival">${data.caballo.nombre}</span></div>
    <div class="irow"><span class="ilbl">Categoría:</span><span class="ival">${data.caballo.categoria ?? '—'}</span></div>
    <div class="irow"><span class="ilbl">Raza:</span><span class="ival">${data.caballo.cat_raza?.nombre ?? '—'}</span></div>
    <div class="irow"><span class="ilbl">Pelaje:</span><span class="ival">${data.caballo.cat_pelaje?.nombre ?? '—'}</span></div>
    ${data.caballo.numero_chip ? `<div class="irow"><span class="ilbl">Chip:</span><span class="ival" style="font-family:monospace">${data.caballo.numero_chip}</span></div>` : ''}
    ${data.caballo.numero_registro ? `<div class="irow"><span class="ilbl">Registro:</span><span class="ival">${data.caballo.numero_registro}</span></div>` : ''}
    ${data.caballo.marca ? `<div class="irow"><span class="ilbl">Propietario:</span><span class="ival">${data.caballo.marca.nombre}</span></div>` : ''}
    ${data.comprador ? `<div class="irow"><span class="ilbl">Comprador:</span><span class="ival">${data.comprador}</span></div>` : ''}
  </div>

  <div class="stitle">Hallazgos clínicos</div>
  <table>
    <thead>
      <tr>
        <th style="width:28%">Sistema / Área</th>
        <th style="width:50%">Hallazgo / Observación</th>
        <th style="width:22%">Resultado</th>
      </tr>
    </thead>
    <tbody>${filas || '<tr><td class="td" colspan="3" style="color:#9ca3af;text-align:center">Sin hallazgos registrados.</td></tr>'}</tbody>
  </table>

  <div class="stitle">Conclusión general</div>
  <div class="cbox">${data.conclusion || '<span style="color:#9ca3af">Sin observaciones adicionales.</span>'}</div>

  <div class="dic-wrap">
    <div class="dic" style="background:${dicColor}18;color:${dicColor};border-color:${dicColor}">
      ${DIC_LABEL[data.dictamen]}
    </div>
  </div>

  <div class="firma-sec">
    <div class="firma-box">
      <div class="firma-line"></div>
      <div class="firma-name">${data.firmante}</div>
      <div class="firma-sub">Médico/a Veterinario/a</div>
      ${data.email ? `<div class="firma-sub">${data.email}</div>` : ''}
    </div>
  </div>

  <div class="footer">
    <span>HarasManager — Revisión Pre-Venta</span>
    <span>${formatFecha(data.fecha)}</span>
  </div>

</div>
<script>
  setTimeout(function(){ window.print() }, 400)
</script>
</body>
</html>`

  win.document.write(html)
  win.document.close()
}
