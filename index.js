const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const carbone = require('carbone');
const path = require('path');
const mongoose = require('mongoose');
const cron = require('node-cron');
const createService = require('./soapService');
const parseXml = require('./xmlParser');

const app = express();
const port = process.env.PORT || 3001;

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Ошибка подключения к MongoDB:'));
db.once('open', () => {
  console.log('Успешное подключение к MongoDB');
});

const invoicesSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true, // Уникальный идентификатор записи
  },
  body: {
    type: JSON,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now, // Время создания записи в БД
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'], // Возможные статусы отправки
    default: 'pending', // Статус по умолчанию
  },
});

const Invoices = mongoose.model('Invoices', invoicesSchema);

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
  
  const writeToDatabase = () => {
    console.log(`writeDatabase`)
    const dataToSave = {
      id: 'uniqueId', // Замените на уникальный идентификатор
      body: 'Сформированные данные',
    };
  
    const newItem = new Item(dataToSave);
  
    newItem.save((err) => {
      if (err) {
        console.error(err);
      } else {
        console.log('Данные успешно записаны в базу данных.');
      }
    });
  };
  let x509Certificate = "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"
  let password = "As123456"
  let username = "730327401669"
  
  cron.schedule('* * * * *', () => {
    const body = {
      tin: '080540002682',
      x509Certificate,
    };

    sessionService('createSession', { username, password, body })
      .then(result => {
        console.log(`sesssssssssionId: ${JSON.stringify(result)}`)
        const body = {
            sessionId: result.sessionId,
            criteria: {
              direction: 'INBOUND',
              dateFrom: (new Date('2023-11-01')).toISOString(),
              dateTo: (new Date('2023-11-08')).toISOString(),
              invoiceStatusList: {
                invoiceStatus: ['CREATED', 'DELIVERED'],
              },
              //...other,
              asc: true,
            },
        }
        invoiceService('queryInvoice', { body })
        .then((response) => {
       //   console.log(JSON.stringify(response.invoiceInfoList))
          
          let serializeResponse = response.invoiceInfoList.invoiceInfo.map((item) => {
            console.log(item.invoice);
            // return {
            //   company: {
            //     bin: item.invoice.consignor.tin,
            //     company: item.invoice.consignor.name,
            //     address: item.invoice.consignor.address,
            //   },
            //   invoice: {
            //     number: item.invoice.num,
            //     type: item.invoice.invoiceType,
            //     status: item.invoiceStatus,
            //     esf_num: item.invoiceId,
            //     esf_long_num: item.registrationNumber,
            //   },
            //   date: {
            //     turnover: item.invoice.turnoverDate,
            //     send: item.invoice.date,
            //   },
            //   sum: {
            //     withNDS: item.invoice.productSet.totalPriceWithTax,
            //     withoutNds: item.invoice.productSet.totalPriceWithoutTax,
            //   },
            // };  
          })
          console.log(`normalObject: ${serializeResponse}`)
        })
    }
      )
      .then((result) => {
        console.log(JSON.stringify(result))
      })
      .catch(error => console.log(error))
    //writeToDatabase();
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
    console.log(JSON.stringify(req.query))
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
