import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';
import EmailBuilder from '../../src/components/emailbuilder/EmailBuilder';
import TextInput from '../../src/components/emailbuilder/App/InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/TextInput';
import TextDimensionInput from '../../src/components/emailbuilder/App/InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/TextDimensionInput';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
function Fixture() {
  const [file, setFile] = useState(null);
  const [value, setValue] = useState('');
  useEffect(() => {
    (async () => {
      const pdf = await PDFDocument.create();
      pdf.addPage().drawText('PDF compatibility');
      setFile({ data: await pdf.save() });
    })();
  }, []);
  return <>
    <TextInput label="Compatibility text" defaultValue="" onChange={setValue} InputProps={{ endAdornment: <span>suffix</span> }} />
    <output data-testid="text-value">{value}</output>
    <TextDimensionInput label="Width" defaultValue={100} onChange={() => {}} />
    {file && <Document file={file}><Page pageNumber={1} renderTextLayer={false} renderAnnotationLayer={false} /></Document>}
    <section data-testid="email-editor"><EmailBuilder /></section>
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
