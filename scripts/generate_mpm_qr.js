const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { QRCodeSVG } = require('qrcode.react');

const uriPayload = 'pirro://pay?type=mpm&merchant=@laguna&name=Laguna+Pizza&city=Tirane';
const jsonPayload = JSON.stringify({
  type: 'PIRRO_MPM',
  version: '1.0',
  merchant_handle: '@laguna',
  name: 'Laguna Pizza',
  city: 'Tiranë',
  category: 'Pizzeria & Bar',
  amount: null,
});
const emvcoPayload = '0002010102112628al.pirro.merchant:@laguna5204581253030085802AL5912Laguna Pizza6006Tirane63044A8F';

function generateSvg(payload, filename) {
  const element = React.createElement(QRCodeSVG, {
    value: payload,
    size: 400,
    level: 'M',
    includeMargin: true,
  });
  const svgString = ReactDOMServer.renderToString(element);
  const outPath = path.join(__dirname, '..', 'public', filename);
  fs.writeFileSync(outPath, svgString);
  console.log('Generated:', filename);
}

generateSvg(uriPayload, 'mpm-laguna-uri.svg');
generateSvg(jsonPayload, 'mpm-laguna-json.svg');
generateSvg(emvcoPayload, 'mpm-laguna-emvco.svg');
// Also save standard default
generateSvg(uriPayload, 'mpm-laguna.svg');
