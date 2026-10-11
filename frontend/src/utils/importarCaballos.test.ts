import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { parsearExcel } from './importarCaballos'

describe('parsearExcel', () => {
  it('lee un xlsx y omite las filas marcadas como ejemplo', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Importar Caballos')
    worksheet.addRows([
      ['nombre', 'fecha_nacimiento', 'categoria', '_ejemplo'],
      ['Ejemplo', '2020-01-01', 'Caballo', 'SI'],
      ['La Niña', new Date('2019-03-20T00:00:00.000Z'), 'Yegua', ''],
    ])
    const bytes = await workbook.xlsx.writeBuffer()
    const file = new File([new Uint8Array(bytes)], 'caballos.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await expect(parsearExcel(file)).resolves.toEqual([
      expect.objectContaining({
        nombre: 'La Niña',
        fecha_nacimiento: '2019-03-20',
        categoria: 'Yegua',
      }),
    ])
  })
})
