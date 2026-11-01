import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';
import { P12Signer } from '@signpdf/signer-p12';
import { SignPdf } from '@signpdf/signpdf';
import { extractSignature } from '@signpdf/utils';
import { Placeholder } from '../cloud/parsefunction/pdf/Placeholder.js';
import { createTransport } from 'nodemailer';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import express from 'express';
import multer from 'multer';

test('application PDF placeholder and P12 signer produce an extractable signature', async () => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = '01';
  certificate.validity.notBefore = new Date();
  certificate.validity.notAfter = new Date(Date.now() + 86400000);
  const attributes = [{ name: 'commonName', value: 'Isolated CI certificate' }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [certificate], 'ci-only', { algorithm: '3des' });
  const buffer = Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary');
  const document = await PDFDocument.create();
  const page = document.addPage();
  page.drawText('Isolated signature compatibility check');
  Placeholder({ pdfDoc: document, pdfPage: page, reason: 'CI', contactInfo: 'ci@example.invalid', name: 'CI', location: 'CI' });
  const pdf = Buffer.from(await document.save({ useObjectStreams: false }));
  const signed = await new SignPdf().sign(pdf, new P12Signer(buffer, { passphrase: 'ci-only' }));
  const extracted = extractSignature(signed);
  assert.ok(extracted.signature.length > 100);
  assert.ok(extracted.signedData.length > 100);
  assert.equal((await PDFDocument.load(signed)).getPageCount(), 1);
  await assert.rejects(new SignPdf().sign(pdf, new P12Signer(buffer, { passphrase: 'wrong' })));
});

test('mail composes attachments without contacting an SMTP server', async () => {
  const transport = createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const result = await transport.sendMail({ from: 'ci@example.invalid', to: 'recipient@example.invalid',
    subject: 'Compatibility', text: 'Isolated test', attachments: [{ filename: 'document.txt', content: 'attachment' }] });
  assert.match(result.message.toString(), /multipart\/mixed/);
  assert.match(result.message.toString(), /document.txt/);
  transport.close();
});

test('memory limiter refuses requests above its configured budget', async () => {
  const limiter = new RateLimiterMemory({ points: 2, duration: 60 });
  await limiter.consume('ci');
  await limiter.consume('ci');
  await assert.rejects(limiter.consume('ci'), value => value.remainingPoints === 0 && value.msBeforeNext > 0);
});

test('multipart upload preserves bytes and enforces the upload limit', async () => {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 32 } });
  app.post('/upload', upload.single('file'), (req, res) => res.json({ content: req.file.buffer.toString() }));
  app.use((error, req, res, next) => res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: error.code }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const send = text => {
      const form = new FormData();
      form.set('file', new Blob([text]), 'document.txt');
      return fetch(`http://127.0.0.1:${server.address().port}/upload`, { method: 'POST', body: form });
    };
    const valid = await send('document');
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { content: 'document' });
    assert.equal((await send('x'.repeat(33))).status, 413);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
