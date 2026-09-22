# Políticas de privacidad de HarasManager

**Fecha de entrada en vigencia:** 20 de septiembre de 2026

Gracias por usar HarasManager, una plataforma web de gestión equina que permite
administrar establecimientos (haras y centros de cría), llevar los registros
sanitarios de cada animal firmados por su veterinario, gestionar la reproducción y
el centro de embriones, y registrar traslados y transferencias de propiedad. La
privacidad de nuestros usuarios y la protección de la información recolectada es
una prioridad para nosotros.

Esta política describe los datos que recopilamos, por qué lo hacemos y cómo los
gestionamos. Te pedimos que leas con atención este documento, que forma parte de
nuestros Términos y Condiciones.

> ⚠️ **Nota interna (borrar antes de publicar).** Este archivo es la fuente de
> verdad del texto; la página `/legales/privacidad`
> ([`LegalPage.tsx`](../frontend/src/pages/legales/LegalPage.tsx)) todavía muestra
> una versión resumida y anterior. Antes de publicarlo como texto vinculante,
> revisar la lista de [Pendientes](#pendientes-antes-de-publicar).

---

## 1. Responsable del tratamiento

La aplicación HarasManager es desarrollada y gestionada por **HarasManager**.

* Domicilio: *(a completar)*
* Correo electrónico: **admin@harasmanager.com**

Los datos se almacenan en servidores de prestadores de servicios de alojamiento y
almacenamiento en la nube, que alojan la base de datos, el sistema de
autenticación y los archivos de la plataforma.

---

## 2. Datos que recolectamos

Recolectamos información para brindar una experiencia funcional, segura y
personalizada. Los datos provienen del usuario, de su actividad en la plataforma
y de los animales que administra.

### 2.1 Datos personales solicitados al usuario

* **Nombre y apellido:** para identificar al usuario dentro de su establecimiento
  y firmar los registros que carga.
* **Correo electrónico:** para el registro, el inicio de sesión, la recuperación
  de la cuenta y las comunicaciones del servicio.
* **Contraseña:** se almacena hasheada por el prestador de servicios de
  autenticación. El equipo de HarasManager no puede verla.
* **DNI:** para identificar de forma única al usuario y validar operaciones
  sensibles (transferencias de propiedad, cambios de permisos).
* **Matrícula profesional (solo veterinarios):** para firmar los registros
  sanitarios con validez profesional.
* **Número de teléfono:** medio adicional de contacto.

### 2.2 Permisos del dispositivo

HarasManager es una aplicación web: no instala nada en el dispositivo ni accede a
sus permisos de manera permanente. Cuando el usuario decide adjuntar una imagen, el
navegador le pide acceso puntual a:

* **Cámara o galería / almacenamiento:** para tomar o seleccionar la foto del
  caballo o la imagen que acompaña a una consulta veterinaria.

### 2.3 Datos de los equinos y del establecimiento

* Ficha del animal: nombre, raza, pelaje, fecha de nacimiento, pedigree,
  ubicación y estado.
* Fotografía del caballo e imágenes adjuntas a las consultas veterinarias.
* Registros sanitarios: consultas, diagnósticos, tratamientos y próximos
  controles, firmados con el nombre y la matrícula del veterinario que los
  registró.
* Datos reproductivos: servicios, tactos y ecografías, flushings, embriones,
  transferencias a receptoras y programa del centro de cría.
* Movimientos entre establecimientos y transferencias de propiedad.

### 2.4 Datos técnicos y de uso

* Rol del usuario y establecimiento (`sociedad_id`) al que pertenece, que
  determinan qué puede ver y hacer dentro de la plataforma.
* Identificador de usuario, usado para atribuir cada registro a quien lo creó.
* **Registro de auditoría:** para las operaciones sensibles (dinero, permisos,
  propiedad de animales y bajas) guardamos quién hizo el cambio, cuándo, y cómo
  estaba el registro antes. Es un registro que solo admite altas: nadie, tampoco
  el usuario auditado, puede modificarlo ni borrarlo.
* Datos de la membresía del veterinario: plan, monto, moneda, estado y fecha del
  pago, e identificadores de la suscripción ante el prestador de servicios de
  pago.

### 2.5 Datos sensibles

El DNI y la matrícula profesional son datos personales identificatorios y los
tratamos con el mismo cuidado que el resto de la información de la cuenta.

**No recolectamos datos sensibles** en los términos del artículo 7 de la Ley
25.326: no pedimos origen racial o étnico, opiniones políticas, convicciones
religiosas, afiliación sindical, ni información sobre la salud o la vida sexual de
las personas. La información sanitaria que se carga en la plataforma corresponde a
**animales**, no a personas. Tampoco recolectamos datos biométricos.

### 2.6 Datos con fines de seguimiento

* **No usamos cookies de seguimiento publicitario**, ni identificadores
  publicitarios, ni vendemos datos a redes de anuncios.
* Los únicos identificadores que conservamos son los propios de la plataforma
  (usuario, establecimiento, registro), usados para la trazabilidad interna y la
  mejora funcional del producto.

### 2.7 Qué datos son obligatorios y qué pasa si no se dan

| Dato | Carácter | Si no se proporciona |
|---|---|---|
| Nombre y apellido | Obligatorio | No se puede crear la cuenta |
| Correo electrónico | Obligatorio | No hay autenticación ni recuperación de contraseña posible |
| Contraseña | Obligatorio | No se puede iniciar sesión |
| DNI | Obligatorio | No se puede crear la cuenta |
| Matrícula (veterinarios) | Obligatorio para firmar | No se pueden registrar consultas con validez profesional |
| Teléfono | Facultativo | No afecta el uso de la plataforma |

En el **formulario de demo** de la landing son obligatorios el nombre, el correo y
el establecimiento; el teléfono, la cantidad de animales, los módulos de interés y
el mensaje son facultativos.

**Datos inexactos** tienen consecuencias concretas: un registro sanitario atribuido
a un profesional equivocado, avisos que no llegan, o el rechazo del cobro de la
membresía. El usuario debe mantener sus datos actualizados y puede pedirnos que
los rectifiquemos en cualquier momento (ver sección 8).

---

## 3. Finalidades del tratamiento

Los datos se utilizan para:

* Crear la cuenta, autenticar al usuario y aplicar los permisos que le
  corresponden según su rol y su establecimiento.
* Identificar a cada animal y llevar su ficha, su pedigree y su ubicación.
* Trazabilidad sanitaria: registros inmutables, firmados por el veterinario que
  los cargó.
* Gestión reproductiva y del centro de cría (servicios, embriones,
  transferencias a receptoras, programa semanal).
* Traslados de animales entre establecimientos y transferencias de propiedad.
* Asociar cada actividad a un usuario real, para saber quién registró qué.
* Cobrar y administrar la membresía del veterinario independiente.
* Coordinar la demo comercial cuando se completa el formulario de contacto.
* Prevención de fraudes y uso indebido, y soporte al usuario.

---

## 4. Asociación de datos y almacenamiento

* Cada registro queda vinculado al usuario que lo creó y al establecimiento al
  que pertenece.
* Cuando un animal se transfiere a otro establecimiento, su ficha y sus registros
  sanitarios lo acompañan, porque la trazabilidad sanitaria es el objeto mismo del
  registro. Eso implica que el establecimiento de destino ve los eventos
  anteriores y los profesionales que los firmaron. Antes de cada transferencia se
  guarda una copia de la ficha, y la operación queda asentada en la auditoría.
* Los datos se almacenan en la nube: la base de datos, la autenticación, los
  archivos y la publicación del sitio están a cargo de prestadores de servicios
  de alojamiento y almacenamiento, que pueden hacerlo fuera de la República
  Argentina (ver sección 5).
* **No usamos notificaciones push** ni servicios de mensajería de terceros.

---

## 5. Compartición de datos

Recolectamos y compartimos datos únicamente en la medida necesaria para prestar
el servicio: hacer funcionar la plataforma, dar acceso a quien corresponde dentro
de cada establecimiento y cobrar la membresía. No los compartimos con ningún otro
fin. Estos son los casos:

* **No vendemos ni cedemos datos a terceros con fines comerciales.**
* Dentro de la plataforma, el acceso depende del rol: los usuarios de un
  establecimiento ven la información de ese establecimiento, y un veterinario
  habilitado ve las fichas y los registros sanitarios de los animales que
  atiende. A su vez, su nombre y su matrícula quedan visibles en los registros
  que firma.
* Fuera de la plataforma, los destinatarios posibles pertenecen a las siguientes
  clases, y en todos los casos intervienen como encargados del tratamiento,
  limitados a lo necesario para prestar su servicio:
  * **Prestadores de servicios de alojamiento y almacenamiento en la nube** —
    base de datos, archivos y publicación del sitio.
  * **Prestadores de servicios de autenticación e identidad** — registro e
    inicio de sesión de los usuarios.
  * **Prestadores de servicios de procesamiento de pagos** — cobro de la
    membresía del veterinario. El pago se completa en el entorno del prestador:
    **HarasManager nunca recibe ni almacena datos de tarjeta**. Le enviamos el
    correo del veterinario y el plan contratado, y recibimos de vuelta el estado
    del pago.
* **Transferencia internacional.** Los destinatarios mencionados pueden
  encontrarse en jurisdicciones que no ofrecen un nivel de protección de los
  datos personales equivalente al de la República Argentina. En esos casos, el
  tratamiento se apoya en los compromisos de confidencialidad y seguridad que
  esos prestadores asumen contractualmente con HarasManager.
* Autoridades, cuando una norma o una orden judicial lo exija.

---

## 6. Bases legales para el tratamiento

Tratamos los datos personales según:

* El **consentimiento** del usuario al registrarse y aceptar los Términos y
  Condiciones.
* La **ejecución del contrato** de servicio con el establecimiento o el
  veterinario.
* El **cumplimiento de obligaciones legales**, en particular las fiscales y
  contables asociadas al cobro de la membresía.
* El **interés legítimo** en la seguridad de la plataforma y en la mejora de la
  experiencia de uso.

---

## 7. Consentimiento

* El uso de la plataforma implica la aceptación de esta política.
* Al iniciar sesión, la aplicación muestra los Términos y Condiciones vigentes y
  exige su aceptación expresa antes de habilitar el uso. Cada aceptación queda
  registrada con la versión aceptada y su fecha.
* Cuando el texto se actualiza de manera sustancial, se vuelve a pedir la
  aceptación por el mismo mecanismo.

---

## 8. Derechos del usuario

El usuario puede:

* **Acceder** a sus datos personales, de forma gratuita a intervalos no menores a
  seis meses (art. 14, Ley 25.326).
* **Rectificar y actualizar** los datos inexactos, incompletos o desactualizados.
* **Solicitar la eliminación** de su cuenta y sus datos, salvo los casos de
  conservación obligatoria descriptos en la sección 9.

**Instructivo al iniciar sesión:** al ingresar a la aplicación, el usuario
encuentra un instructivo que explica en qué consisten estos derechos y cómo
ejercerlos, para que no tenga que buscarlos en este documento.

**Cómo ejercerlos hoy:** escribiendo a **admin@harasmanager.com** desde el correo
registrado en la cuenta. Respondemos los pedidos de acceso dentro de los **10 días
corridos** y los de rectificación o supresión dentro de los **5 días hábiles**,
según los artículos 14 y 16 de la Ley 25.326.

**Cómo van a poder ejercerse:** la aplicación va a incorporar, en la
configuración de cada usuario, una pantalla de **"Modificar datos personales"**
desde la que se podrá consultar los datos almacenados, rectificarlos y solicitar
su eliminación sin pasar por el correo. Hoy el botón ya está en la app y anuncia
esa función como próxima.

**Reclamo ante la autoridad de control:** la Agencia de Acceso a la Información
Pública (AAIP), órgano de control de la Ley 25.326, atiende las denuncias y
reclamos de quienes vean afectados sus derechos.

---

## 9. Conservación de los datos

| Dato | Plazo |
|---|---|
| Datos de cuenta | Mientras la cuenta esté activa, y hasta su eliminación a pedido del titular |
| Registros sanitarios y fichas de animales | Se conservan por trazabilidad sanitaria, aun después de que el usuario que los cargó deje la plataforma |
| Registro de auditoría | Se conserva aunque se elimine el usuario auditado: el rastro tiene que sobrevivir a la baja |
| Datos de pagos | Por el plazo que exige la normativa fiscal y contable aplicable |
| Datos del formulario de demo | Hasta que el contacto pida su baja o pierda vigencia comercial |

Una solicitud de supresión de los datos de cuenta no borra los registros
sanitarios de los animales ni el registro de auditoría: son registros cuyo valor está en ser
completos, y su conservación queda amparada por el artículo 16 de la Ley 25.326.
En esos casos disociamos los datos personales del titular en la medida en que sea
posible sin romper la trazabilidad, y se lo informamos.

---

## 10. Protección de menores

HarasManager no recolecta datos de menores de 18 años. La plataforma está dirigida
a personas mayores de edad que operan un establecimiento equino o prestan
servicios profesionales. Si se detecta un uso indebido, se procederá a la
eliminación de la cuenta.

---

## 11. Cambios en la política

Cualquier modificación será publicada en el sitio oficial y dentro de la
aplicación, y la fecha de entrada en vigencia se actualizará en consecuencia. Los
cambios relevantes se notifican a los usuarios registrados.

---

## 12. Ley aplicable

Esta política se rige por la **Ley 25.326 de Protección de Datos Personales** y
demás normativa aplicable de la República Argentina.

---

## Anexo interno — cobertura del artículo 6 de la Ley 25.326

*(Referencia para el equipo, no forma parte del texto publicado.)*

| Inciso | Qué exige | Dónde está |
|---|---|---|
| a) | Finalidad y destinatarios | Secciones 3 y 5 |
| b) | Existencia de la base, identidad y domicilio del responsable | Sección 1 |
| c) | Carácter obligatorio o facultativo de las respuestas | Sección 2.7 |
| d) | Consecuencias de darlos, negarse o que sean inexactos | Sección 2.7 |
| e) | Derechos de acceso, rectificación y supresión | Sección 8 |

## Pendientes antes de publicar

- [ ] Revisión por un abogado, en particular la conservación de datos tras una
      solicitud de supresión y el tratamiento de los registros sanitarios.
- [ ] Completar el domicilio legal (y razón social / CUIT si corresponde) del
      responsable — hoy la sección 1 lo tiene vacío.
- [ ] Inscribir la base de datos en el Registro Nacional de Bases de Datos de la AAIP.
- [ ] Verificar los acuerdos de tratamiento de datos (DPA) de cada prestador, ya
      que la sección 5 se apoya en esos compromisos contractuales para la
      transferencia internacional.
- [ ] **Revisar el bucket `caballos` de Supabase Storage:** hoy las fotos de los
      caballos y las imágenes adjuntas a las consultas clínicas se sirven por URL
      pública (`getPublicUrl`), sin pasar por RLS. Quien tenga el link accede al
      archivo. O se pasa el bucket a privado con URLs firmadas, o la política
      tiene que decirlo explícitamente.
- [ ] Volcar este texto en `/legales/privacidad`, que hoy muestra la versión resumida.
- [ ] Implementar la pantalla "Modificar datos personales" (acceso, rectificación
      y eliminación desde la app), hoy anunciada como próxima.
- [ ] **Implementar el instructivo al iniciar sesión.** La sección 8 y la página
      `/legales/privacidad` ya lo anuncian, pero todavía no existe: hoy lo único
      que aparece al ingresar es el modal de Términos y Condiciones. Hasta que se
      construya, el texto afirma algo que el sistema no hace.
- [ ] Borrar la nota interna del encabezado y este anexo antes de publicar.
