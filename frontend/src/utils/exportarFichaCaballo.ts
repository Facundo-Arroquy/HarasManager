import type { Caballo } from '../services/caballoService'
import type { HistorialEntry } from '../components/domain/HistorialCard'
import type { RegistroClinicoCria, Flushing, TransferenciaEmbrionaria } from '../types/crianza'
import { formatFecha, calcularEdad } from './fecha'

export interface FichaCaballoData {
  caballo: Caballo
  historial: HistorialEntry[]
  caballos?: Caballo[]
  registrosCria?: RegistroClinicoCria[]
  flushings?: Flushing[]
  transferencias?: TransferenciaEmbrionaria[]
}

function resolveNombre(
  id: string | null | undefined,
  nombre: string | null | undefined,
  caballos: Caballo[]
): { nombre: string; registrado: boolean } | null {
  if (id) {
    const found = caballos.find((c) => c.id === id)
    if (found) return { nombre: found.nombre, registrado: true }
  }
  if (nombre) return { nombre, registrado: false }
  return null
}

function fmtFecha(f: string): string {
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

export function exportarFichaCaballo(data: FichaCaballoData) {
  const win = window.open('', '_blank', 'width=900,height=1200')
  if (!win) {
    alert('No se pudo abrir la ventana de impresión. Habilitá las ventanas emergentes en tu navegador.')
    return
  }

  const { caballo, historial, caballos = [], registrosCria = [], flushings = [], transferencias = [] } = data
  const hoy = new Date().toISOString().slice(0, 10)

  // ── Genealogía ───────────────────────────────────────────────────────────────
  const padre = resolveNombre(caballo.padre_id, caballo.padre_nombre, caballos)
  const madre = resolveNombre(caballo.madre_id, caballo.madre_nombre, caballos)

  const padreRaw = caballo.padre_id ? caballos.find((c) => c.id === caballo.padre_id) : null
  const madreRaw = caballo.madre_id ? caballos.find((c) => c.id === caballo.madre_id) : null

  const abPat  = padreRaw ? resolveNombre(padreRaw.padre_id, padreRaw.padre_nombre, caballos) : null
  const abPat2 = padreRaw ? resolveNombre(padreRaw.madre_id, padreRaw.madre_nombre, caballos) : null
  const abMat  = madreRaw ? resolveNombre(madreRaw.padre_id, madreRaw.padre_nombre, caballos) : null
  const abMat2 = madreRaw ? resolveNombre(madreRaw.madre_id, madreRaw.madre_nombre, caballos) : null

  type GNode = { nombre: string; registrado: boolean } | null

  function treeNode(node: GNode, label: string, size: 'md' | 'sm' = 'md'): string {
    const w = size === 'sm' ? 'width:130px' : 'width:150px'
    if (!node) {
      return `<div class="tn tn-empty" style="${w}">
        <span class="tn-label">${label}</span>
        <span class="tn-dash">—</span>
      </div>`
    }
    const cls = node.registrado ? 'tn-reg' : 'tn-ext'
    const badge = node.registrado
      ? '<span class="tn-badge tn-badge-reg">registrado</span>'
      : '<span class="tn-badge tn-badge-ext">externo</span>'
    return `<div class="tn ${cls}" style="${w}">
      <span class="tn-label">${label}</span>
      <span class="tn-name">${node.nombre}</span>
      ${badge}
    </div>`
  }

  function fork(): string {
    return `<div class="fork"><div class="fork-t"></div><div class="fork-b"></div></div>`
  }

  const hasGenealogy = padre || madre
  const genealogiaHtml = hasGenealogy ? `
    <div class="stitle">Genealogía</div>
    <div class="tree-wrap">

      <!-- Nivel 0: sujeto -->
      <div class="tree-center">
        ${treeNode({ nombre: caballo.nombre, registrado: true }, 'Sujeto')}
      </div>

      ${fork()}

      <!-- Nivel 1: padres + sus bifurcaciones -->
      <div class="tree-parents">

        <!-- Padre (mitad superior) -->
        <div class="tree-half">
          <div class="tree-half-inner">
            ${treeNode(padre, 'Padre')}
            ${fork()}
            <!-- Nivel 2: abuelos paternos -->
            <div class="tree-grandparents">
              <div class="tree-gp-half">${treeNode(abPat,  'Abuelo paterno', 'sm')}</div>
              <div class="tree-gp-half">${treeNode(abPat2, 'Abuela paterna', 'sm')}</div>
            </div>
          </div>
        </div>

        <!-- Madre (mitad inferior) -->
        <div class="tree-half">
          <div class="tree-half-inner">
            ${treeNode(madre, 'Madre')}
            ${fork()}
            <!-- Nivel 2: abuelos maternos -->
            <div class="tree-grandparents">
              <div class="tree-gp-half">${treeNode(abMat,  'Abuelo materno', 'sm')}</div>
              <div class="tree-gp-half">${treeNode(abMat2, 'Abuela materna', 'sm')}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  ` : ''

  // ── Historial clínico ────────────────────────────────────────────────────────
  const historicoSorted = [...historial].sort(
    (a, b) => new Date(b.fecha_consulta).getTime() - new Date(a.fecha_consulta).getTime()
  )

  function medicamentosHtml(meds: HistorialEntry['historial_medicamento']): string {
    if (!meds.length) return ''
    const rows = meds.map((m) => `
      <tr>
        <td class="td">${m.medicamento}</td>
        <td class="td">${m.dosis ?? '—'}</td>
        <td class="td">${m.via_administracion ?? '—'}</td>
        <td class="td">${m.duracion_dias != null ? `${m.duracion_dias} días` : '—'}</td>
      </tr>
    `).join('')
    return `
      <div class="sub-title">Medicamentos</div>
      <table class="sub-table">
        <thead>
          <tr>
            <th>Medicamento</th><th>Dosis</th><th>Vía</th><th>Duración</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
  }

  function partesHtml(partes: HistorialEntry['historial_parte_afectada']): string {
    if (!partes.length) return ''
    const items = partes.map((p) => {
      const lado = p.lado && p.lado !== 'no aplica' ? ` · ${p.lado}` : ''
      const desc = p.descripcion ? ` — ${p.descripcion}` : ''
      return `<li class="parte-item"><strong>${p.cat_parte_cuerpo.nombre}</strong>${lado}${desc}</li>`
    }).join('')
    return `<div class="sub-title">Partes afectadas</div><ul class="partes-list">${items}</ul>`
  }

  const consultasHtml = historicoSorted.length === 0
    ? '<p class="empty-msg">Sin registros clínicos.</p>'
    : historicoSorted.map((e) => `
      <div class="consulta">
        <div class="consulta-hdr">
          <div class="consulta-tipo">${e.cat_tipo_consulta.nombre}</div>
          <div class="consulta-meta">
            Dr/a. ${e.usuario.nombre} ${e.usuario.apellido}
            <span class="consulta-fecha">${fmtFecha(e.fecha_consulta)}</span>
          </div>
        </div>
        ${e.diagnostico ? `<p class="consulta-campo"><span class="consulta-lbl">Diagnóstico:</span> ${e.diagnostico}</p>` : ''}
        ${e.tratamiento ? `<p class="consulta-campo"><span class="consulta-lbl">Tratamiento:</span> ${e.tratamiento}</p>` : ''}
        ${e.observaciones ? `<p class="consulta-campo consulta-obs">${e.observaciones}</p>` : ''}
        ${medicamentosHtml(e.historial_medicamento)}
        ${partesHtml(e.historial_parte_afectada)}
        ${e.proxima_consulta ? `<p class="proxima">Próxima consulta: ${fmtFecha(e.proxima_consulta)}</p>` : ''}
      </div>
    `).join('')

  // ── Reproductivo ─────────────────────────────────────────────────────────────
  const hasReproductivo = registrosCria.length > 0 || flushings.length > 0 || transferencias.length > 0

  const registrosHtml = registrosCria.length === 0 ? '' : `
    <div class="rep-section">
      <div class="rep-title">Registros reproductivos (${registrosCria.length})</div>
      <table>
        <thead><tr><th>Fecha</th><th>Ovarios / Útero</th><th>Padrillo</th><th>Veterinario</th><th>Observaciones</th></tr></thead>
        <tbody>
          ${registrosCria.map((r) => {
            const chips = [
              ...r.ovario_izq.map((c) => `OI:${c}`),
              ...r.ovario_der.map((c) => `OD:${c}`),
              ...r.utero.map((c) => c),
              ...r.obs_chips.map((c) => c),
            ].join(', ')
            return `<tr>
              <td class="td">${formatFecha(r.fecha)}</td>
              <td class="td">${chips || '—'}</td>
              <td class="td">${r.padrillo?.nombre ?? '—'}</td>
              <td class="td">${r.veterinario ? `Dr/a. ${r.veterinario.apellido}` : '—'}</td>
              <td class="td">${r.observaciones ?? '—'}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  `

  const flushingsHtml = flushings.length === 0 ? '' : `
    <div class="rep-section">
      <div class="rep-title">Flushings (${flushings.length})</div>
      <table>
        <thead><tr><th>Fecha</th><th>Resultado</th><th>Estadio</th><th>Grado</th><th>Padrillo</th><th>Vet.</th></tr></thead>
        <tbody>
          ${flushings.map((f) => `<tr ${f.cancelado ? 'style="opacity:.55"' : ''}>
            <td class="td">${formatFecha(f.fecha)}</td>
            <td class="td">${f.es_negativo ? 'Negativo' : `${f.cantidad} embrión(es)`}</td>
            <td class="td">${f.estadio ?? '—'}</td>
            <td class="td">${f.grado != null ? `G${f.grado}` : '—'}</td>
            <td class="td">${f.padrillo?.nombre ?? '—'}</td>
            <td class="td">${f.veterinario ? `Dr/a. ${f.veterinario.apellido}` : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `

  const transferenciasHtml = transferencias.length === 0 ? '' : `
    <div class="rep-section">
      <div class="rep-title">Transferencias embrionarias (${transferencias.length})</div>
      <table>
        <thead><tr><th>Fecha</th><th>Donante</th><th>Receptora</th><th>Padrillo</th><th>Clasificación</th><th>Vet.</th></tr></thead>
        <tbody>
          ${transferencias.map((t) => `<tr>
            <td class="td">${formatFecha(t.fecha)}</td>
            <td class="td">${t.donante?.nombre ?? '—'}</td>
            <td class="td">${t.receptora?.nombre ?? '—'}</td>
            <td class="td">${t.padrillo?.nombre ?? '—'}</td>
            <td class="td">${[t.clasificacion, t.cl_calidad ? `CL ${t.cl_calidad}` : ''].filter(Boolean).join(' · ') || '—'}</td>
            <td class="td">${t.veterinario ? `Dr/a. ${t.veterinario.apellido}` : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `

  const reproductivoHtml = hasReproductivo ? `
    <div class="stitle">Reproductivo</div>
    ${registrosHtml}
    ${flushingsHtml}
    ${transferenciasHtml}
  ` : ''

  // ── Datos identificatorios ───────────────────────────────────────────────────
  const edad = caballo.fecha_nacimiento ? calcularEdad(caballo.fecha_nacimiento) : null

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Ficha — ${caballo.nombre}</title>
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
    table{width:100%;border-collapse:collapse;font-size:9pt}
    th{text-align:left;padding:5px 8px;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:#f3f4f6;border-bottom:1.5px solid #d1d5db}
    .td{padding:5px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
    tr:last-child .td{border-bottom:none}
    tr:nth-child(even){background:#fafafa}

    /* ── Árbol genealógico ── */
    .tree-wrap{display:flex;align-items:stretch;min-height:190px;margin-top:6px;overflow-x:auto}
    .tree-center{display:flex;align-items:center;flex-shrink:0}
    .tree-parents{display:flex;flex-direction:column;flex-shrink:0}
    .tree-half{flex:1;display:flex;align-items:stretch}
    .tree-half-inner{display:flex;align-items:stretch;width:100%}
    .tree-grandparents{display:flex;flex-direction:column;flex-shrink:0}
    .tree-gp-half{flex:1;display:flex;align-items:center}
    /* Fork connector */
    .fork{width:20px;display:flex;flex-direction:column;align-self:stretch;flex-shrink:0}
    .fork-t{flex:1;border-right:1.5px solid #9ca3af;border-bottom:1.5px solid #9ca3af}
    .fork-b{flex:1;border-right:1.5px solid #9ca3af;border-top:1.5px solid #9ca3af}
    /* Tree nodes */
    .tn{border-radius:5px;padding:6px 9px;display:flex;flex-direction:column;gap:2px;align-self:center}
    .tn-empty{border:1px dashed #d1d5db;background:#fafafa}
    .tn-reg{border:1px solid #6ee7b7;background:#ecfdf5}
    .tn-ext{border:1px solid #d1d5db;background:#f9fafb}
    .tn-label{font-size:7pt;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em}
    .tn-name{font-size:9.5pt;font-weight:700;color:#111;line-height:1.2}
    .tn-dash{font-size:9pt;color:#d1d5db}
    .tn-badge{font-size:6.5pt;padding:1px 5px;border-radius:3px;font-weight:700;align-self:flex-start;margin-top:2px}
    .tn-badge-reg{background:#d1fae5;color:#065f46}
    .tn-badge-ext{background:#f3f4f6;color:#6b7280}

    /* ── Consultas ── */
    .consulta{border:1px solid #e5e7eb;border-radius:4px;padding:9px 11px;margin-bottom:7px;break-inside:avoid}
    .consulta-hdr{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;gap:8px}
    .consulta-tipo{font-size:9pt;font-weight:700;color:#065f46}
    .consulta-meta{font-size:8pt;color:#6b7280;text-align:right}
    .consulta-fecha{margin-left:8px;font-size:8pt;color:#9ca3af}
    .consulta-campo{font-size:9pt;margin-bottom:3px}
    .consulta-lbl{font-weight:600;color:#374151}
    .consulta-obs{color:#6b7280;font-style:italic}
    .proxima{font-size:8pt;color:#065f46;margin-top:5px;font-weight:600}
    .empty-msg{font-size:9pt;color:#9ca3af;text-align:center;padding:12px 0}

    /* ── Sub-tablas ── */
    .sub-title{font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin:6px 0 3px}
    .sub-table{font-size:8.5pt;margin-bottom:4px}
    .partes-list{list-style:none;margin:2px 0 4px;padding:0}
    .parte-item{font-size:8.5pt;color:#374151;padding:1px 0}

    /* ── Reproductivo ── */
    .rep-section{margin-bottom:10px}
    .rep-title{font-size:8pt;font-weight:700;color:#374151;margin:8px 0 4px}

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
        <div class="hdr-title">Ficha del Caballo</div>
        <div class="hdr-sub">HarasManager — Registro individual del animal</div>
      </div>
    </div>
    <div class="hdr-date">Generado el ${fmtFecha(hoy)}</div>
  </div>

  <div class="stitle">Datos identificatorios</div>
  <div class="igrid">
    <div class="irow"><span class="ilbl">Nombre:</span><span class="ival">${caballo.nombre}</span></div>
    <div class="irow"><span class="ilbl">Categoría:</span><span class="ival">${caballo.categoria ?? '—'}${caballo.subcategoria ? ` · ${caballo.subcategoria}` : ''}</span></div>
    <div class="irow"><span class="ilbl">Raza:</span><span class="ival">${caballo.cat_raza?.nombre ?? '—'}</span></div>
    <div class="irow"><span class="ilbl">Pelaje:</span><span class="ival">${caballo.cat_pelaje?.nombre ?? '—'}</span></div>
    ${caballo.fecha_nacimiento ? `<div class="irow"><span class="ilbl">Nacimiento:</span><span class="ival">${fmtFecha(caballo.fecha_nacimiento)}${edad ? ` (${edad})` : ''}</span></div>` : ''}
    ${caballo.campo?.nombre ? `<div class="irow"><span class="ilbl">Campo:</span><span class="ival">${caballo.campo.nombre}</span></div>` : ''}
    ${caballo.numero_chip ? `<div class="irow"><span class="ilbl">Chip:</span><span class="ival" style="font-family:monospace">${caballo.numero_chip}</span></div>` : ''}
    ${caballo.numero_registro ? `<div class="irow"><span class="ilbl">Registro:</span><span class="ival">${caballo.numero_registro}</span></div>` : ''}
  </div>

  ${genealogiaHtml}

  <div class="stitle">Historial clínico (${historial.length} consultas)</div>
  ${consultasHtml}

  ${reproductivoHtml}

  <div class="footer">
    <span>HarasManager · Ficha del Caballo</span>
    <span>${caballo.nombre} — ${fmtFecha(hoy)}</span>
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
