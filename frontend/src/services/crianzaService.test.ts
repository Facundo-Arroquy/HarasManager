import { describe, it, expect, beforeEach, vi } from 'vitest'

// El cliente de Supabase se reemplaza por uno falso: estos tests cubren qué
// hace el servicio con lo que la base responde (en particular, un UPDATE que
// la RLS dejó en 0 filas), no la red.
type Resultado = { data: unknown; error: unknown }

const { rpc, from, update, eq, inFiltro, select, proximo } = vi.hoisted(() => {
  const proximo: { valor: Resultado } = { valor: { data: null, error: null } }
  // Cadena `from().update().eq()/in().select()`: cada eslabón devuelve la misma
  // cadena y `select` —el último— cierra con la respuesta programada.
  const cadena: Record<string, unknown> = {}
  const update = vi.fn(() => cadena)
  const eq = vi.fn(() => cadena)
  const inFiltro = vi.fn(() => cadena)
  const select = vi.fn(() => Promise.resolve(proximo.valor))
  Object.assign(cadena, { update, eq, in: inFiltro, select })
  return {
    rpc: vi.fn(() => Promise.resolve(proximo.valor)),
    from: vi.fn(() => cadena),
    update, eq, inFiltro, select, proximo,
  }
})

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc, from }),
}))

const { crianzaService } = await import('./crianzaService')

function responder(data: unknown, error: unknown = null) {
  proximo.valor = { data, error }
}

beforeEach(() => {
  vi.clearAllMocks()
  responder(null)
})

describe('posponerRecordatorio — va por la RPC, no por updates sueltos', () => {
  const guardado = { fecha_vto: '2026-10-28', fecha_original: '2026-10-25', estado: 'pendiente' }

  it('llama a posponer_recordatorio con los parámetros de la RPC y devuelve la fila guardada', async () => {
    responder(guardado)

    const res = await crianzaService.posponerRecordatorio('rec-1', '2026-10-28', 'pospuesto_3d')

    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('posponer_recordatorio', {
      p_id: 'rec-1', p_nueva_fecha: '2026-10-28', p_motivo: 'pospuesto_3d',
    })
    expect(res).toEqual(guardado)
    // Nada de SELECT / INSERT / UPDATE por separado: es lo que dejaba la
    // reprogramación a medias.
    expect(from).not.toHaveBeenCalled()
  })

  it('propaga el error de la RPC (sin permiso, ya cerrado) en vez de tragarlo', async () => {
    const sinPermiso = { message: 'No tenés permiso para posponer este recordatorio', code: '42501' }
    responder(null, sinPermiso)

    await expect(crianzaService.posponerRecordatorio('rec-1', '2026-10-28', null)).rejects.toBe(sinPermiso)
  })
})

describe('UPDATE directos de cria_recordatorio — 0 filas es un error, no un éxito', () => {
  const MENSAJE = /no tenés permiso/

  describe('actualizarEstadoRecordatorio', () => {
    it('tira un error claro cuando la RLS no dejó actualizar ninguna fila', async () => {
      responder([])
      await expect(crianzaService.actualizarEstadoRecordatorio('rec-1', 'cancelado')).rejects.toThrow(MENSAJE)
    })

    it('tira un error claro cuando la respuesta viene sin datos', async () => {
      responder(null)
      await expect(crianzaService.actualizarEstadoRecordatorio('rec-1', 'hecho')).rejects.toThrow(MENSAJE)
    })

    it('resuelve cuando se actualizó la fila, y pide las filas de vuelta para poder contarlas', async () => {
      responder([{ id: 'rec-1' }])

      await expect(crianzaService.actualizarEstadoRecordatorio('rec-1', 'cancelado', 'motivo')).resolves.toBeUndefined()

      expect(update).toHaveBeenCalledWith({ estado: 'cancelado', cancel_motivo: 'motivo' })
      expect(eq).toHaveBeenCalledWith('id', 'rec-1')
      expect(select).toHaveBeenCalledWith('id')
    })

    it('un error de la base sigue siendo ese error', async () => {
      const caido = { message: 'boom' }
      responder(null, caido)
      await expect(crianzaService.actualizarEstadoRecordatorio('rec-1', 'hecho')).rejects.toBe(caido)
    })
  })

  describe('marcarRecordatoriosHechos', () => {
    it('tira un error claro cuando no se pudo cerrar ninguno', async () => {
      responder([])
      await expect(crianzaService.marcarRecordatoriosHechos(['a', 'b'])).rejects.toThrow(MENSAJE)
    })

    it('devuelve solo los ids que cambiaron (la RLS puede dejar afuera a algunos)', async () => {
      responder([{ id: 'a' }])

      const cerrados = await crianzaService.marcarRecordatoriosHechos(['a', 'b'])

      expect(cerrados).toEqual(['a'])
      expect(update).toHaveBeenCalledWith({ estado: 'hecho' })
      expect(inFiltro).toHaveBeenCalledWith('id', ['a', 'b'])
      expect(inFiltro).toHaveBeenCalledWith('estado', ['pendiente', 'vencido'])
    })

    it('sin ids no consulta la base', async () => {
      await expect(crianzaService.marcarRecordatoriosHechos([])).resolves.toEqual([])
      expect(from).not.toHaveBeenCalled()
    })
  })

  describe('actualizarRecordatorio (edición de notas)', () => {
    it('tira un error claro cuando no se actualizó ninguna fila', async () => {
      responder([])
      await expect(crianzaService.actualizarRecordatorio('rec-1', { notas: 'x' })).rejects.toThrow(MENSAJE)
    })

    it('resuelve cuando se actualizó la fila', async () => {
      responder([{ id: 'rec-1' }])

      await expect(crianzaService.actualizarRecordatorio('rec-1', { notas: 'x' })).resolves.toBeUndefined()

      expect(update).toHaveBeenCalledWith({ notas: 'x' })
      expect(select).toHaveBeenCalledWith('id')
    })
  })
})
