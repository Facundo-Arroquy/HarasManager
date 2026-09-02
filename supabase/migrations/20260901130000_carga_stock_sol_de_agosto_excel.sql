-- Reconstrucción de padrillos/madres referenciados como progenitores en el
-- import de stock de Sol de Agosto (ver docs del PR). Se revisaron a mano los
-- nombres candidatos: se excluyeron combinaciones ("A / B"), duplicados
-- evidentes del mismo animal escrito distinto, y valores basura -- esos
-- quedan como texto libre (padre_nombre/madre_nombre) en la migración de carga.
INSERT INTO caballo (id, nombre, categoria, sexo, sociedad_id, observaciones, activo)
VALUES
  ('a96b380b-6b9d-4c26-bf75-dbc230010eb4', 'Manolo', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('cc0c152f-260f-41b0-8072-36476f68d5b4', 'Galleta', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('e99221e4-c05a-4c3b-9a91-fb24f0dcfd1b', 'Tronador', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('9de58bbb-a9ac-46f9-af6f-a5e29cad78fb', 'Charito', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('d30a24b3-0462-4201-b5b4-0e98b52600f6', 'Chaveta', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('f0ee975a-302c-4fcb-b3ca-dc6f6d133af9', 'Selva negra', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('d516f882-d7ab-4fd8-aa1a-112fcb0f7f85', 'Chelo', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('13abc3e0-4e3b-4db4-bbd6-657e03e9b046', 'Olivia', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('ae5dd8b2-d87f-4f6e-8029-9c4a62c07098', 'Nochera', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('a37f1d1f-65bf-43d4-a569-9d41983ad024', 'Florcita', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('83b7e0d4-2436-460d-9e11-447e47fc68a2', 'Chavetita', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('928414a3-cece-45cb-88d4-53818e6b06cb', 'Xenon', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('ac12704a-c6ab-4101-b7ce-90cfa6fc6cf0', 'Avispa', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('d6a1b6e0-7414-4c07-9949-241e00213cbe', 'Capaz', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('c3b822eb-3ea4-4fb1-9437-0f43f4373f20', 'Mojada', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('746abb3f-ff06-450e-928e-feece9e091f1', 'Tabasco West', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('8924c0f8-1733-4625-ad57-5da1aa3e340c', 'Martineta', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('b6463952-75de-4551-bfb9-d8e0fbfa34bd', 'Paquita', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('5aa70dc4-e816-4e83-b5cd-ff5c9fa8ea15', 'AW Pobre Vieja', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('bd754b4c-f6ba-4142-8e44-b09747081f26', 'Flower', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('e0edbf61-f947-44c1-9c3a-6428d61df095', 'Nocherita', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('7be2e134-fc24-4d2c-8ff0-627bac4379be', 'Pitu Poy', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('b0c2283f-4ca2-4556-88a8-ddb7b932a00a', 'Justa', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('0566e179-bc94-49d1-84e0-eb4712128161', 'Aw Any chica', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('00713e86-4f62-442c-9505-3ac5a9a94f7c', 'Sonrisa', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('5e3d5ed5-b117-4f00-b174-0c69ccdfe884', 'Any Tuerta 330', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('4e709d17-b009-4b92-aeae-3877f4d8b945', '190 Catskill', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('3492495a-bd0c-4890-b5a6-8911ec0adfa6', 'Preferida', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('bcc5421c-ebe6-4811-b6f9-57d8c0631c82', 'Keka', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('daa40747-16b1-40a2-a660-40b6758222d9', 'Selva grande 170', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('2989831f-5eab-4592-ad64-63f120aa44ab', 'Selva 160', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('9ce8f776-5478-42b6-966c-2593bd43c3d8', 'Open Sacerdote', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('ad9951f5-fc20-4d81-ac02-dc3b78f089c7', 'Mulita 274', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('b7b3123c-24ce-41ea-be21-653f72072662', 'Portentoso', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('7b82ca1e-cc9d-4515-80fc-64e12cc7cfce', 'Aw 398 ursula', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('4abd06f5-73a3-484b-ba93-1a9fa24b11b9', 'Rumba', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('57a24a71-8e2b-4373-8810-73858edba373', 'Aw Any Negra', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('45f8beee-5d2d-41db-bab9-866eaeee70c8', 'Viajera', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('11e0035b-4800-412f-8c23-a43ed7804f79', 'Milagritos', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('f4b7df70-2328-429b-b59b-25875cba185c', 'Espirudina', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('1e4f0272-08ad-4331-8ae1-7294ea5a1dc1', 'Picardia', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('e2c2079f-df7f-4dfb-8859-4327936367c2', 'P3', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('2c78cdef-88c7-4469-b77e-a7c536d5c87f', 'Mafalda', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('ccd886de-5c35-4a76-8f3f-7b61eea6fba0', 'GALLETITA', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('bc15b23c-beeb-483c-be92-571ccf04caf3', 'AGUSTINA', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('763f12c4-a0c9-475c-b31b-eb739d7c8540', 'Gete Lunarejo', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('d99a446b-4b11-4919-bb6a-15ebdc69a21b', 'Dolfina Cuarteto', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('89ebd038-2943-4a35-b31c-b81af50c6fbf', 'Machitos Chelo', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('403b105c-c555-4f09-891a-90a26f83174e', 'Dolfina Boing', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('e03320ba-5741-4426-ab79-181112b934aa', 'B 09 cuartetera', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('bcf5d283-810e-4eca-8643-d4c776f46d89', 'Southern Halo', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('992c20c8-c177-49e6-b6dd-656347a35c56', 'Irina', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('fbeb226e-7919-4fda-a44c-5ae8f2fd4cc3', 'Open Sobretodo', 'Padrillo', 'M', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE),
  ('2d41a831-4580-4423-a54a-01a8db5db487', 'Ilusion', 'Yegua', 'H', 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Reconstruido para preservar genealogía del import de Sol de Agosto — verificar datos', TRUE);
-- Carga de los 120 caballos de Sol de Agosto (hoja "Haras manager", filas con
-- Ubicación = SDA), con padre_id/madre_id resueltos contra los padrillos/madres
-- reconstruidos en la migración anterior cuando fue posible.
INSERT INTO caballo (
  id, nombre, numero_registro, numero_chip, sexo, categoria, rol_reproductivo,
  fecha_nacimiento, pelaje_id, raza_id, sociedad_id, observaciones,
  padre_id, padre_nombre, madre_id, madre_nombre, activo
)
VALUES
  ('c39fb82a-6d3f-4f58-a91c-78c4a094af6e', 'RP 207', '207', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, 'cc0c152f-260f-41b0-8072-36476f68d5b4', NULL, TRUE),
  ('a521346b-6572-47d5-8248-43e68ef19a66', 'RP 208', '208', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'e99221e4-c05a-4c3b-9a91-fb24f0dcfd1b', NULL, '9de58bbb-a9ac-46f9-af6f-a5e29cad78fb', NULL, TRUE),
  ('40b2534d-1266-4c05-9bb1-d3ae7641bee1', 'RP 210', '210', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, 'd30a24b3-0462-4201-b5b4-0e98b52600f6', NULL, TRUE),
  ('38a4809f-95d8-4563-9ac3-696fae447ba2', 'RP 211', '211', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', NULL, NULL, 'f0ee975a-302c-4fcb-b3ca-dc6f6d133af9', NULL, TRUE),
  ('9f965256-fb27-46cc-a27b-008e04294aed', 'RP 213', '213', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'd516f882-d7ab-4fd8-aa1a-112fcb0f7f85', NULL, 'cc0c152f-260f-41b0-8072-36476f68d5b4', NULL, TRUE),
  ('46283906-373d-492e-968f-0785a73dedd6', 'RP 217', '217', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', NULL, NULL, '13abc3e0-4e3b-4db4-bbd6-657e03e9b046', NULL, TRUE),
  ('a33805ac-fb9b-45f1-bc73-cbae4ac154a3', 'RP 219', '219', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, 'ae5dd8b2-d87f-4f6e-8029-9c4a62c07098', NULL, TRUE),
  ('8847ea99-8bbe-4171-bd16-4cf71f07cd70', 'RP 221', '221', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, NULL, 'Any', TRUE),
  ('40b1ee85-8381-463f-8d77-8fda52e8eef7', 'RP 222', '222', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, 'cc0c152f-260f-41b0-8072-36476f68d5b4', NULL, TRUE),
  ('b4bcbc45-702f-4963-a375-10f5c686fab7', 'RP 224', '224', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, NULL, 'Visa', TRUE),
  ('f1473b0d-af3c-42c2-a1bc-ecfcb6c8f514', 'RP 226', '226', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, 'a37f1d1f-65bf-43d4-a569-9d41983ad024', NULL, TRUE),
  ('9bdfd6bc-f59c-43fb-a121-b0caa686e156', 'RP 227', '227', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, '83b7e0d4-2436-460d-9e11-447e47fc68a2', NULL, TRUE),
  ('68e02528-a9de-4d61-934c-4514cf10d4e9', 'RP 229', '229', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', NULL, NULL, NULL, '190', TRUE),
  ('12a51f9b-1592-4921-9be6-f1de9e6aa527', 'sun river 230', '230', NULL, 'H', 'Yegua', NULL, '2010-10-22', NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, NULL, NULL, 'Sun River', TRUE),
  ('48666918-c980-4313-b3c4-751dffeb3012', 'RP 234', '234', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', '928414a3-cece-45cb-88d4-53818e6b06cb', NULL, 'ac12704a-c6ab-4101-b7ce-90cfa6fc6cf0', NULL, TRUE),
  ('61591a91-5db2-4e1f-aa7a-f2c08f738ce0', 'RP 235', '235', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, 'd6a1b6e0-7414-4c07-9949-241e00213cbe', NULL, TRUE),
  ('d6bf2a3b-ff6d-4cff-80c2-44419d497b14', 'RP 238', '238', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', NULL, NULL, NULL, 'Belen', TRUE),
  ('8787e0a2-ed97-43ac-aa77-96a1d609ce98', 'RP 239', '239', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, 'c3b822eb-3ea4-4fb1-9437-0f43f4373f20', NULL, TRUE),
  ('09398bc1-99bd-4ba6-bed6-acbcba2c1b98', 'RP 240', '240', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', '746abb3f-ff06-450e-928e-feece9e091f1', NULL, '8924c0f8-1733-4625-ad57-5da1aa3e340c', NULL, TRUE),
  ('5fc30539-f33a-48e0-926e-eaf07e75fed4', 'RP 241', '241', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', NULL, NULL, 'ac12704a-c6ab-4101-b7ce-90cfa6fc6cf0', NULL, TRUE),
  ('5ff0bf6a-61cf-46bf-91c1-c64cb09bcfaa', 'RP 242', '242', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'd516f882-d7ab-4fd8-aa1a-112fcb0f7f85', NULL, 'b6463952-75de-4551-bfb9-d8e0fbfa34bd', NULL, TRUE),
  ('6a5b2994-7a19-4398-9cb2-47e9588e9338', 'RP 245', '245', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, 'b6463952-75de-4551-bfb9-d8e0fbfa34bd', NULL, TRUE),
  ('da9928dc-18e9-4336-b2d2-8d724b595d55', 'RP 249', '249', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', 'a96b380b-6b9d-4c26-bf75-dbc230010eb4', NULL, 'd30a24b3-0462-4201-b5b4-0e98b52600f6', NULL, TRUE),
  ('8eec9506-3c4b-4567-a607-6ac0b3f99fbb', 'RP 252', '252', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', '746abb3f-ff06-450e-928e-feece9e091f1', NULL, 'ac12704a-c6ab-4101-b7ce-90cfa6fc6cf0', NULL, TRUE),
  ('fa5d41c2-8441-49f9-9b5d-43d66d65fe6c', 'RP 255', '255', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2010/2011', '746abb3f-ff06-450e-928e-feece9e091f1', NULL, 'cc0c152f-260f-41b0-8072-36476f68d5b4', NULL, TRUE),
  ('26b801f3-63ca-42eb-9eaa-1a0de60e7c29', 'RP 562', '562', NULL, 'H', 'Yegua', NULL, NULL, 18, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2017/2018', NULL, NULL, '5aa70dc4-e816-4e83-b5cd-ff5c9fa8ea15', NULL, TRUE),
  ('3384a6c9-8db5-4eeb-993b-15cd037404ff', 'RP 577', '577', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2017/2018', NULL, NULL, NULL, 'Selva', TRUE),
  ('449141cd-cd37-4d1a-933d-32367fb0f4c4', 'Canabis', '623', NULL, 'H', 'Yegua', NULL, '2019-08-01', 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, NULL, 'bd754b4c-f6ba-4142-8e44-b09747081f26', NULL, TRUE),
  ('9c85937f-860f-45c6-bc2c-f74397cbb6cb', 'Piba', '625', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '5aa70dc4-e816-4e83-b5cd-ff5c9fa8ea15', NULL, TRUE),
  ('a7bea94a-de98-4f53-a729-0aa87263ab4c', 'Farola', '626', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'e0edbf61-f947-44c1-9c3a-6428d61df095', NULL, TRUE),
  ('1d4557bc-94a4-4a9a-8ad0-96cfe570883f', 'Pita', '627', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '7be2e134-fc24-4d2c-8ff0-627bac4379be', NULL, TRUE),
  ('0f1f64dc-3cdf-493c-8ddc-01e5dd68d0aa', 'Jueza', '628', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'b0c2283f-4ca2-4556-88a8-ddb7b932a00a', NULL, TRUE),
  ('58e3a69f-0481-4cb4-829a-b901d05f8612', 'Puestera', '629', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'b6463952-75de-4551-bfb9-d8e0fbfa34bd', NULL, TRUE),
  ('b89716aa-4922-4168-a932-b5d606de9767', 'Pocha', '630', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '7be2e134-fc24-4d2c-8ff0-627bac4379be', NULL, TRUE),
  ('42601845-57f1-4dee-a4f5-696d51e72a96', 'Antonia', '631', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('28ac1d61-bce4-4573-b9cc-a41e6d0008f0', 'Aitana', '632', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('03add555-9f42-4b1c-9da1-80b263448abf', 'Amapola', '633', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'bd754b4c-f6ba-4142-8e44-b09747081f26', NULL, TRUE),
  ('bf4c9f3b-98fc-40a3-a208-a6a4668f41a8', 'Diosa', '634', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, NULL, 'Belen Jugadora', TRUE),
  ('112d79b4-b162-4dbd-987b-13ebe8d73c0b', 'Mermelada', '635', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '00713e86-4f62-442c-9505-3ac5a9a94f7c', NULL, TRUE),
  ('b4a3d452-7df4-4c2a-b394-a0c3382089b1', 'Amalia', '636', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('4bcf7ecf-2a08-45f6-ae7a-8e04702670e9', 'Tita', '637', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'cc0c152f-260f-41b0-8072-36476f68d5b4', NULL, TRUE),
  ('562ebf2e-dca9-41f7-b083-1964d1030f6a', 'Begonia', '638', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, NULL, 'Belen Jugadora', TRUE),
  ('86f2a057-676d-43d6-a3c3-409420548e9d', 'Solar', '639', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, NULL, 'Sun River', TRUE),
  ('6f711bba-f9cc-4a2f-8603-24382c2de9d9', 'Jamaica', '640', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'a37f1d1f-65bf-43d4-a569-9d41983ad024', NULL, TRUE),
  ('f90b9673-fac3-4efb-8a47-7994147c803c', 'Prienda', '641', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '7be2e134-fc24-4d2c-8ff0-627bac4379be', NULL, TRUE),
  ('1f3749a9-a393-4817-86ff-d8a4e779744c', 'Antonella', '642', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('514df2f9-ebff-45f3-a099-72a663be84e3', 'Honesta', '643', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'b0c2283f-4ca2-4556-88a8-ddb7b932a00a', NULL, TRUE),
  ('3e58e19d-b10b-4a67-b7f6-c843e34098f8', 'Opera', '644', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'cc0c152f-260f-41b0-8072-36476f68d5b4', NULL, TRUE),
  ('826bf61a-0cc2-46a9-a3d9-b98da509cbeb', 'SDA sin identificar 1', NULL, NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020 | Pelaje (excel): zaina c blanca', NULL, 'Sacerdote', '5e3d5ed5-b117-4f00-b174-0c69ccdfe884', NULL, TRUE),
  ('0f8e8109-8520-41b3-9cf5-8db398641365', 'S/N 1', '1', NULL, 'H', 'Yegua', NULL, NULL, 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '4e709d17-b009-4b92-aeae-3877f4d8b945', NULL, TRUE),
  ('f78405de-df8f-44a5-b62a-e4d3dd821a69', 'Fatima', '12', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '3492495a-bd0c-4890-b5a6-8911ec0adfa6', NULL, TRUE),
  ('62b63288-5087-403e-adab-0a432c1be0b8', 'Cuarta', '15', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, 'Sacerdote', 'bcc5421c-ebe6-4811-b6f9-57d8c0631c82', NULL, TRUE),
  ('348eb84a-ef93-4a23-9b6f-c1bce6e6681c', 'Chita', '15', NULL, 'H', 'Yegua', NULL, NULL, 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'daa40747-16b1-40a2-a660-40b6758222d9', NULL, TRUE),
  ('b435007f-93d6-46b2-bff9-d6fbc8b90379', 'S/N 2', NULL, NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, NULL, 'Visa -', TRUE),
  ('32a3146d-d0cd-4d23-bd4a-b476f8a50cb1', 'Rifle', NULL, NULL, 'M', 'Caballo', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, NULL, 'Ani Chica', TRUE),
  ('785a4e11-449b-435d-8a3a-474ca6acee03', 'Tarzan', '1', NULL, 'M', 'Caballo', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, '2989831f-5eab-4592-ad64-63f120aa44ab', NULL, TRUE),
  ('ffc10f88-2535-4e8f-853c-0692659247f7', 'Cacho', '5', NULL, 'M', 'Caballo', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, 'Sensacion', NULL, 'Sun River', TRUE),
  ('717e9ea3-7274-4552-a670-13da316c7517', 'Pepe', '6/645', NULL, 'M', 'Caballo', NULL, '2019-12-01', 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, NULL, NULL, 'Ani chica', TRUE),
  ('b72e65d2-d8ac-440c-8038-7665ad71fcfa', 'Flaco', '7/647', NULL, 'M', 'Caballo', NULL, '2019-12-05', 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, NULL, NULL, 'Ani chica', TRUE),
  ('d0e95c09-161e-40a8-b471-cc315bd854da', 'RP 8/649', '8/649', NULL, 'M', 'Caballo', NULL, '2019-12-14', 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, 'Sensacion', NULL, 'Sun River', TRUE),
  ('ccf14816-021e-4ba6-8c71-fafb50e15823', 'Tiago', '10/650', NULL, 'M', 'Caballo', NULL, '2020-01-02', 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('e72adacd-cfc9-4b05-b262-efa0407d871c', 'Peach', '646', NULL, 'M', 'Padrillo', NULL, '2020-01-12', 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): alazna', NULL, 'Sensacion', '7be2e134-fc24-4d2c-8ff0-627bac4379be', NULL, TRUE),
  ('54462653-9ade-4726-bec0-08a50ed0dfd6', 'RP 623', '623', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, NULL, 'bd754b4c-f6ba-4142-8e44-b09747081f26', NULL, TRUE),
  ('6a182368-1a4c-4990-a5df-e666392f4cd5', 'S/N 3', '2', NULL, 'M', 'Caballo', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020', NULL, 'Sensacion', '7be2e134-fc24-4d2c-8ff0-627bac4379be', NULL, TRUE),
  ('880b2bc0-288d-4355-aba4-5669557ea7e7', 'S/N 4', '3', NULL, 'M', 'Caballo', NULL, NULL, 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2019/2020 | Pelaje (excel): z col', NULL, 'NN', NULL, 'colorado', TRUE),
  ('5f4b3e83-c5b7-4f1d-955d-65916adee11f', 'Pobre Vieja 01', 'PV01', '981098109017867', 'H', 'Yegua', 'Donante', NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, 'Genetica clon', NULL, 'Genetica clon', TRUE),
  ('0f509cab-d4b0-4ea8-8949-f30fe0bd5161', 'RP 25', '25', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Fecha sin parsear (excel): manada', '9ce8f776-5478-42b6-966c-2593bd43c3d8', NULL, 'ad9951f5-fc20-4d81-ac02-dc3b78f089c7', NULL, TRUE),
  ('81691292-70c2-411d-b6cf-40c35a00b796', 'RP 27', '27', NULL, 'H', 'Yegua', NULL, NULL, 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Fecha sin parsear (excel): manada', NULL, 'Sacerdote', NULL, 'visa irenarca 172', TRUE),
  ('8c0ee519-85aa-4ca0-bfc9-c3b84509f659', 'RP 681', '681', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', 'b7b3123c-24ce-41ea-be21-653f72072662', NULL, NULL, 'Sobaquito', TRUE),
  ('27f177e5-21ed-4607-9c2d-873383072db4', 'RP 682', '682', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, NULL, 'Mulita', TRUE),
  ('694d9dc5-b7a3-4e0e-94a4-0887a52212df', 'RP 683', '683', NULL, 'H', 'Yegua', NULL, NULL, 7, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022 | Pelaje (excel): Picaza', 'b7b3123c-24ce-41ea-be21-653f72072662', NULL, NULL, 'Sun River J', TRUE),
  ('ed30d7ec-ac69-4e9f-9575-dc6a030e509a', 'RP 684', '684', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, NULL, 'Sobaquito', TRUE),
  ('20e7b9f4-8626-4975-b3c2-f008fd25d2d9', 'RP 685', '685', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('0aac5be9-1627-4f49-88e9-009b64ed4f9d', 'RP 686', '686', NULL, 'H', 'Yegua', NULL, NULL, 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, NULL, 'Belen J', TRUE),
  ('ebd840e2-71d7-46e6-b98a-56c5c3365186', 'RP 687', '687', NULL, 'H', 'Yegua', NULL, NULL, 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '7b82ca1e-cc9d-4515-80fc-64e12cc7cfce', NULL, TRUE),
  ('105ea1fe-d064-44a6-a297-203609fa01aa', 'RP 688', '688', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '4abd06f5-73a3-484b-ba93-1a9fa24b11b9', NULL, TRUE),
  ('30e483a2-2fb9-44ed-b34a-9dbb0593302b', 'RP 690', '690', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '57a24a71-8e2b-4373-8810-73858edba373', NULL, TRUE),
  ('e054c433-4a11-4300-a3b5-45d922d93df5', 'RP 691', '691', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, 'e0edbf61-f947-44c1-9c3a-6428d61df095', NULL, TRUE),
  ('d5587d94-554e-44d1-a399-db1f23e21fe4', 'RP 692', '692', NULL, 'H', 'Yegua', NULL, NULL, 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('a42ce9ce-d790-413b-9c32-982fee479761', 'RP 694', '694', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, 'bd754b4c-f6ba-4142-8e44-b09747081f26', NULL, TRUE),
  ('7a81f7af-82c3-47a6-b185-cde53156bc56', 'RP 695', '695', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '45f8beee-5d2d-41db-bab9-866eaeee70c8', NULL, TRUE),
  ('a2db4143-5a53-48f9-8083-85cf0480c1c0', 'RP 696', '696', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, NULL, 'Belen J', TRUE),
  ('c492d420-16e4-466e-9fa0-3feda5ec1f06', 'Amiga mia', '697', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('85f436b1-674f-4c4b-853f-b60971e66d1b', 'RP 698', '698', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '11e0035b-4800-412f-8c23-a43ed7804f79', NULL, TRUE),
  ('3d8c1764-b1b5-4c75-a2af-546d431c8ba4', 'RP 699', '699', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, 'bd754b4c-f6ba-4142-8e44-b09747081f26', NULL, TRUE),
  ('07a54a58-4034-48e5-97a9-368c7cb79cb5', 'RP 700', '700', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '00713e86-4f62-442c-9505-3ac5a9a94f7c', NULL, TRUE),
  ('31bd95d7-6c9b-4e6b-b7a5-c24a4b6d2006', 'RP 701', '701', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, 'f4b7df70-2328-429b-b59b-25875cba185c', NULL, TRUE),
  ('55ac7077-716d-4f49-b71a-7d8da728f986', '(pueden estar camb con 701', '702', NULL, 'H', 'Yegua', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, '384 (galleta sensa )', NULL, 'Sacerdote', TRUE),
  ('d0be9052-5233-4c27-a772-071d1cf96514', 'RP 703', '703', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022 | Pelaje (excel): ???', NULL, '255 (galleta tabasco)', NULL, 'Sacerdote', TRUE),
  ('6b964b51-96d1-4cc4-bb12-dbfc4818f3c4', 'RP 704', '704', NULL, 'M', 'Caballo', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '1e4f0272-08ad-4331-8ae1-7294ea5a1dc1', NULL, TRUE),
  ('c3c83e8c-e77c-4958-8b52-652819d52d7c', 'RP 705', '705', NULL, 'M', 'Caballo', NULL, NULL, 12, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('cd855da6-8b34-4fc2-9a93-adbfc85faa85', 'RP 711', '711', NULL, 'M', 'Caballo', NULL, NULL, 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '4abd06f5-73a3-484b-ba93-1a9fa24b11b9', NULL, TRUE),
  ('40e69791-aa8e-4a4c-a927-68f2895db1ea', 'RP 680', '680', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '45f8beee-5d2d-41db-bab9-866eaeee70c8', NULL, TRUE),
  ('48c1401f-83b6-4d31-b347-1dc9b912107f', 'RP 677', '677', NULL, 'H', 'Yegua', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, 'e0edbf61-f947-44c1-9c3a-6428d61df095', NULL, TRUE),
  ('5842d3fb-9350-476d-a1bb-f38ac712a98b', 'RP 689', '689', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, NULL, 'Aw 318', TRUE),
  ('40b33405-a46f-493d-bd0b-4b7add3f9346', 'RP 693', '693', NULL, 'H', 'Yegua', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, NULL, 'Belen J', TRUE),
  ('83d17ca5-bc45-47a1-ad56-396629620d84', 'RP 705', '705', NULL, 'M', 'Padrillo', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '0566e179-bc94-49d1-84e0-eb4712128161', NULL, TRUE),
  ('922674a2-4002-4286-8775-ff750dcc4309', 'RP 711', '711', NULL, 'M', 'Padrillo', NULL, NULL, NULL, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Temporada (excel): 2021/2022', NULL, NULL, '4abd06f5-73a3-484b-ba93-1a9fa24b11b9', NULL, TRUE),
  ('17997618-a1ad-4f03-aa08-bbbfa34f0226', 'Belen 01', 'B01', '981098109001146', 'H', 'Yegua', 'Donante', '2023-10-23', 2, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, NULL, 'Genetica clon', NULL, 'Genetica clon', TRUE),
  ('6fdaa1a8-c026-425e-afcf-cd53e4f77627', 'RP 846', '846', '981098109025468', 'H', 'Yegua', NULL, '2024-10-04', 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): A', NULL, NULL, 'e2c2079f-df7f-4dfb-8859-4327936367c2', NULL, TRUE),
  ('b6fc3c88-330a-412b-910f-a51ae2e462e9', 'RP 863', '863', '981098109012721', 'H', 'Yegua', NULL, '2024-12-04', 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): Z ', NULL, NULL, '2c78cdef-88c7-4469-b77e-a7c536d5c87f', NULL, TRUE),
  ('90455245-a75a-49a7-9542-22ac9efaba01', 'RP 882', '882', '981098109017774', 'H', 'Yegua', NULL, '2025-01-22', 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): Z', NULL, NULL, 'ccd886de-5c35-4a76-8f3f-7b61eea6fba0', NULL, TRUE),
  ('2b89ffa2-c33b-4d78-b11e-b0c7ee6982cd', 'RP 885', '885', '981098109001397', 'H', 'Yegua', NULL, '2025-02-01', 2, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): TOR', NULL, NULL, 'bc15b23c-beeb-483c-be92-571ccf04caf3', NULL, TRUE),
  ('dfd50946-e85b-4421-b7c4-1844b9ab0011', 'RP 890', '890', NULL, 'H', 'Yegua', NULL, '2025-02-24', 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): ZC | Chip (excel, formato inválido): 98109810900155', NULL, 'Irenarca / Turro', NULL, 'Sobaquito / P5', TRUE),
  ('4a180839-3c03-4c9d-98c7-42a10712a212', 'RP 896', '896', '981098109001347', 'H', 'Potrillo', NULL, '2025-04-11', 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): Z', NULL, 'Sensacion', NULL, 'SRJ', TRUE),
  ('50e3de31-ede5-4884-8079-d0ce89cb376e', 'Pobre Vieja 02', 'PV02', NULL, 'H', 'Yegua', 'Donante', '2024-07-13', 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): A | Chip duplicado en excel (repetido, anulado): 981098109017867', NULL, 'Genetica clon', NULL, 'Genetica clon', TRUE),
  ('5372075b-7dc0-4f33-b3c1-0afe1ef78080', 'Pobre Vieja 03', 'PV03', '981098109017883', 'H', 'Yegua', 'Donante', '2024-08-06', 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): A', NULL, 'Genetica clon', NULL, 'Genetica clon', TRUE),
  ('3dc47512-b65f-4589-8ffb-9fc92367128b', 'Pobre Vieja 04', 'PV04', '981098109017823', 'H', 'Yegua', 'Donante', '2024-08-28', 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): A', NULL, 'Genetica clon', NULL, 'Genetica clon', TRUE),
  ('9a243091-5d26-453c-914e-ecbcdc4085dc', 'Pobre Vieja 05', 'PV05', '981098109148160', 'H', 'Yegua', 'Donante', '2025-01-02', 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): A', NULL, 'Genetica clon', NULL, 'Genetica clon', TRUE),
  ('36f5ed33-dc56-4628-a749-50293fb47bc2', 'Serenata 01', 'SO1', '981098109001339', 'H', 'Yegua', 'Donante', '2024-11-30', 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): ZC', NULL, 'Genetica clon', NULL, 'Genetica clon', TRUE),
  ('3235ea1a-8601-4c89-b597-76890ee702d2', 'Serenata 02', 'SO2', '981098109001391', 'H', 'Yegua', 'Donante', '2024-12-11', 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): ZC', NULL, 'Genetica clon', NULL, 'Genetica clon', TRUE),
  ('a63ad4eb-5042-46e5-9005-d5b42fe6840c', 'Serenata 03', 'SO3', '981098109001399', 'H', 'Yegua', 'Donante', '2024-12-06', 13, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', 'Pelaje (excel): ZC', NULL, 'Genetica clon', NULL, 'Genetica clon', TRUE),
  ('e7b5af33-b1fe-4119-bf14-124ebfe8057a', 'Vison', NULL, NULL, 'M', 'Padrillo', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, '763f12c4-a0c9-475c-b31b-eb739d7c8540', NULL, NULL, 'Visa', TRUE),
  ('6e96926b-a550-4b79-acbc-6ec21bbb344c', 'Biscocho', NULL, NULL, 'M', 'Padrillo', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, 'd99a446b-4b11-4919-bb6a-15ebdc69a21b', NULL, 'cc0c152f-260f-41b0-8072-36476f68d5b4', NULL, TRUE),
  ('1a8ae623-6134-4d2f-b19f-4c17c9c7caeb', 'Anillo', NULL, NULL, 'M', 'Padrillo', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, 'd99a446b-4b11-4919-bb6a-15ebdc69a21b', NULL, NULL, 'Any', TRUE),
  ('fa4ef88f-1724-4b30-ac8e-271a32cca553', 'Che', NULL, NULL, 'M', 'Padrillo', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, '89ebd038-2943-4a35-b31c-b81af50c6fbf', NULL, 'd30a24b3-0462-4201-b5b4-0e98b52600f6', NULL, TRUE),
  ('ed7e9345-6e27-4bee-96a3-3b1ccdb040f5', 'Turro', NULL, NULL, 'M', 'Padrillo', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, '403b105c-c555-4f09-891a-90a26f83174e', NULL, 'e03320ba-5741-4426-ab79-181112b934aa', NULL, TRUE),
  ('f3078eec-7020-4cda-b1f7-ec3e3d5316de', 'Irenarca', NULL, NULL, 'M', 'Padrillo', NULL, NULL, 1, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, 'bcf5d283-810e-4eca-8643-d4c776f46d89', NULL, '992c20c8-c177-49e6-b6dd-656347a35c56', NULL, TRUE),
  ('080aedfb-dc41-4b87-9a63-3d6e78e1996b', 'Che', NULL, NULL, 'M', 'Padrillo', NULL, NULL, 3, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, '89ebd038-2943-4a35-b31c-b81af50c6fbf', NULL, 'd30a24b3-0462-4201-b5b4-0e98b52600f6', NULL, TRUE),
  ('7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb', 'Open Sensacion', NULL, NULL, 'M', 'Padrillo', NULL, NULL, 14, 10, 'fc880764-c628-4961-92f9-527a0bf03d8f', NULL, 'fbeb226e-7919-4fda-a44c-5ae8f2fd4cc3', NULL, '2d41a831-4580-4423-a54a-01a8db5db487', NULL, TRUE);

-- Pedigree resuelto contra otra fila del mismo lote (no un stub)
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '38a4809f-95d8-4563-9ac3-696fae447ba2';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '46283906-373d-492e-968f-0785a73dedd6';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '68e02528-a9de-4d61-934c-4514cf10d4e9';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '12a51f9b-1592-4921-9be6-f1de9e6aa527';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = 'd6bf2a3b-ff6d-4cff-80c2-44419d497b14';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '5fc30539-f33a-48e0-926e-eaf07e75fed4';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '26b801f3-63ca-42eb-9eaa-1a0de60e7c29';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '3384a6c9-8db5-4eeb-993b-15cd037404ff';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '449141cd-cd37-4d1a-933d-32367fb0f4c4';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '9c85937f-860f-45c6-bc2c-f74397cbb6cb';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = 'a7bea94a-de98-4f53-a729-0aa87263ab4c';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '1d4557bc-94a4-4a9a-8ad0-96cfe570883f';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '0f1f64dc-3cdf-493c-8ddc-01e5dd68d0aa';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '58e3a69f-0481-4cb4-829a-b901d05f8612';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = 'b89716aa-4922-4168-a932-b5d606de9767';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '42601845-57f1-4dee-a4f5-696d51e72a96';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '28ac1d61-bce4-4573-b9cc-a41e6d0008f0';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '03add555-9f42-4b1c-9da1-80b263448abf';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = 'bf4c9f3b-98fc-40a3-a208-a6a4668f41a8';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '112d79b4-b162-4dbd-987b-13ebe8d73c0b';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = 'b4a3d452-7df4-4c2a-b394-a0c3382089b1';
UPDATE caballo SET padre_id = '080aedfb-dc41-4b87-9a63-3d6e78e1996b' WHERE id = '4bcf7ecf-2a08-45f6-ae7a-8e04702670e9';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '562ebf2e-dca9-41f7-b083-1964d1030f6a';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '86f2a057-676d-43d6-a3c3-409420548e9d';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '6f711bba-f9cc-4a2f-8603-24382c2de9d9';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = 'f90b9673-fac3-4efb-8a47-7994147c803c';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '1f3749a9-a393-4817-86ff-d8a4e779744c';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '514df2f9-ebff-45f3-a099-72a663be84e3';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '3e58e19d-b10b-4a67-b7f6-c843e34098f8';
UPDATE caballo SET padre_id = '6e96926b-a550-4b79-acbc-6ec21bbb344c' WHERE id = '0f8e8109-8520-41b3-9cf5-8db398641365';
UPDATE caballo SET padre_id = '6e96926b-a550-4b79-acbc-6ec21bbb344c' WHERE id = 'f78405de-df8f-44a5-b62a-e4d3dd821a69';
UPDATE caballo SET padre_id = '6e96926b-a550-4b79-acbc-6ec21bbb344c' WHERE id = '348eb84a-ef93-4a23-9b6f-c1bce6e6681c';
UPDATE caballo SET padre_id = '080aedfb-dc41-4b87-9a63-3d6e78e1996b' WHERE id = '32a3146d-d0cd-4d23-bd4a-b476f8a50cb1';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '785a4e11-449b-435d-8a3a-474ca6acee03';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = '717e9ea3-7274-4552-a670-13da316c7517';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = 'b72e65d2-d8ac-440c-8038-7665ad71fcfa';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = 'ccf14816-021e-4ba6-8c71-fafb50e15823';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '54462653-9ade-4726-bec0-08a50ed0dfd6';
UPDATE caballo SET padre_id = '1a8ae623-6134-4d2f-b19f-4c17c9c7caeb' WHERE id = '27f177e5-21ed-4607-9c2d-873383072db4';
UPDATE caballo SET padre_id = '1a8ae623-6134-4d2f-b19f-4c17c9c7caeb' WHERE id = 'ed30d7ec-ac69-4e9f-9575-dc6a030e509a';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = '20e7b9f4-8626-4975-b3c2-f008fd25d2d9';
UPDATE caballo SET padre_id = '1a8ae623-6134-4d2f-b19f-4c17c9c7caeb' WHERE id = '0aac5be9-1627-4f49-88e9-009b64ed4f9d';
UPDATE caballo SET padre_id = '1a8ae623-6134-4d2f-b19f-4c17c9c7caeb' WHERE id = 'ebd840e2-71d7-46e6-b98a-56c5c3365186';
UPDATE caballo SET padre_id = '1a8ae623-6134-4d2f-b19f-4c17c9c7caeb' WHERE id = '105ea1fe-d064-44a6-a297-203609fa01aa';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '30e483a2-2fb9-44ed-b34a-9dbb0593302b';
UPDATE caballo SET padre_id = '080aedfb-dc41-4b87-9a63-3d6e78e1996b' WHERE id = 'e054c433-4a11-4300-a3b5-45d922d93df5';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = 'd5587d94-554e-44d1-a399-db1f23e21fe4';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = 'a42ce9ce-d790-413b-9c32-982fee479761';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = '7a81f7af-82c3-47a6-b185-cde53156bc56';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = 'a2db4143-5a53-48f9-8083-85cf0480c1c0';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = 'c492d420-16e4-466e-9fa0-3feda5ec1f06';
UPDATE caballo SET padre_id = '1a8ae623-6134-4d2f-b19f-4c17c9c7caeb' WHERE id = '85f436b1-674f-4c4b-853f-b60971e66d1b';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '3d8c1764-b1b5-4c75-a2af-546d431c8ba4';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '07a54a58-4034-48e5-97a9-368c7cb79cb5';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '31bd95d7-6c9b-4e6b-b7a5-c24a4b6d2006';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = '6b964b51-96d1-4cc4-bb12-dbfc4818f3c4';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = 'c3c83e8c-e77c-4958-8b52-652819d52d7c';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = 'cd855da6-8b34-4fc2-9a93-adbfc85faa85';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = '40e69791-aa8e-4a4c-a927-68f2895db1ea';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '48c1401f-83b6-4d31-b347-1dc9b912107f';
UPDATE caballo SET padre_id = 'e7b5af33-b1fe-4119-bf14-124ebfe8057a' WHERE id = '5842d3fb-9350-476d-a1bb-f38ac712a98b';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '40b33405-a46f-493d-bd0b-4b7add3f9346';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = '83d17ca5-bc45-47a1-ad56-396629620d84';
UPDATE caballo SET padre_id = '7ec6e589-bb5c-4dbc-a88e-d0bda8082ccb' WHERE id = '922674a2-4002-4286-8775-ff750dcc4309';
UPDATE caballo SET padre_id = 'ed7e9345-6e27-4bee-96a3-3b1ccdb040f5' WHERE id = '6fdaa1a8-c026-425e-afcf-cd53e4f77627';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = 'b6fc3c88-330a-412b-910f-a51ae2e462e9';
UPDATE caballo SET padre_id = 'f3078eec-7020-4cda-b1f7-ec3e3d5316de' WHERE id = '90455245-a75a-49a7-9542-22ac9efaba01';
UPDATE caballo SET padre_id = '080aedfb-dc41-4b87-9a63-3d6e78e1996b' WHERE id = '2b89ffa2-c33b-4d78-b11e-b0c7ee6982cd';
