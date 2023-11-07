const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const carbone = require('carbone');
const path = require('path');

const createService = require('./soapService');
const parseXml = require('./xmlParser');

const app = express();
const port = process.env.PORT || 3001;

const getStatus = ({ response }) => (response ? response.statusCode : 500);

const getJson = error => (
  error.response
    ? { ...error, soapError: error.root.Envelope.Body.Fault }
    : error
);

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const initializeApp = ([invoiceService, sessionService]) => {
  app.get('/v1', (req, res) => {
    res.send('Service started...')
  });

  app.post('/v1/sessions/createsession', (req, res) => {
    const { username, password, x509Certificate } = req.body;
    const body = {
      tin: '080540002682',
      x509Certificate,
    };

    sessionService('createSession', { username, password, body })
      .then(result => res.json(result))
      .catch(error => res.status(getStatus(error)).json(getJson(error)))
  });

  app.post('/v1/sessions/closesession', (req, res) => {
    const { username, password, sessionId } = req.body;
    const body = { sessionId }

    sessionService('closeSession', { username, password, body })
      .then(result => res.json(result))
      .catch(error => res.status(getStatus(error)).json(getJson(error)))
  });

  app.post('/v1/sessions/currentuser', (req, res) => {
    const { username, password, sessionId } = req.body;
    const body = { sessionId };

    sessionService('currentUser', { username, password, body })
      .then(result => res.json(result))
      .catch(error => res.status(getStatus(error)).json(getJson(error)))
  })

  app.post('/v1/sessions/currentuserprofiles', (req, res) => {
    const { username, password, sessionId } = req.body;
    const body = { sessionId };

    sessionService('currentUserProfiles', { username, password, body })
      .then(result => res.json(result))
      .catch(error => res.status(getStatus(error)).json(getJson(error)))
  });

  app.get('/v1/invoices/queryinvoice',  async (req, res) => {
    console.log(`sessionId: ${req.get('Session-ID')}`);
    const {
      direction, dateFrom, dateTo, statuses, ...other
    } = req.query;
    const body = {
      sessionId: req.get('Session-ID'),
      criteria: {
        direction,
        dateFrom: (new Date(dateFrom)).toISOString(),
        dateTo: (new Date(dateTo)).toISOString(),
        invoiceStatusList: {
          invoiceStatus: statuses,
        },
        ...other,
        asc: true,
      },
    };
    invoiceService('queryInvoice', { body })
      .then(parseXml)
      .then(async (result)=> {

        carbone.render(__dirname + '/templates/template-1.xlsx', result, async function(err, result){
          if (err) {
            return console.log(err);
          }
          // write the result
          fs.writeFileSync('result.xlsx', result);
          //toBase64
          let contentFile = await fs.readFileSync(__dirname + '/result.xlsx', "base64");
          result.contentBase64  = contentFile;
        });

        res.json(result)
      })
      .catch(error => res.status(getStatus(error)).json(getJson(error)))
  });

  app.get('/v1/download', (req, res) => {
    const filePath = path.join(__dirname+'/result.xlsx'); // Путь к файлу на сервере
    res.sendFile(filePath);
  });

  app.post('/v1/excel', async (req, res) => {
    try {

      const transformedObject = {
        "invoiceInfoList": {
          "invoiceInfo": [
            req.body
          ]
        }
      };

      carbone.render(__dirname + '/templates/template-1.xlsx', transformedObject, async function (err, result) {
        if (err) {
          return console.log(err);
        }
        // Write the result to a file
        fs.writeFileSync('result-one-doc.xlsx', result);

        // Convert the file content to base64
        let contentFile = await fs.readFileSync(__dirname + '/result-one-doc.xlsx', 'base64');
        res.json(
            {
              "pdfBase64": contentFile
            }
        );
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(port, () => console.log('Listening on port:', port)) // eslint-disable-line no-console
};

Promise.all([
  createService('invoice'),
  createService('session'),
])
  .then(initializeApp)
  .catch((error) => {
    throw error
  });

module.exports = app;
