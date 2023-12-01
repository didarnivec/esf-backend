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
const axios = require('axios');

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
    enum: ['CREATED', 'DELIVERED', 'REVOKED', 'CANCELED', 'PENDING'], // Возможные статусы отправки
    default: 'PENDING', // Статус по умолчанию
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
  
  const writeToDatabase = async(body) => {
  
      body.forEach(async (item) => {
        try {
        const dataToSave = {
          id: item.invoice.esf_num, 
          body: item,
          status: item.invoice.status
        };
      const invoice = new Invoices(dataToSave);
      await invoice.save()
        .then(() => {
          console.log('Данные успешно сохранены в MongoDB.');
        })
        .catch((error) => {
          console.error('Ошибка при сохранении данных в MongoDB:', error);
        }); 
      } catch(error) {
        throw error;
      }
    });
  };

async function sendData(data) {
  const userSap = 'msesf';
  const passSap = '4bK8A4.%,o1G';
  const authString = `${userSap}:${passSap}`;
  const base64AuthString = Buffer.from(authString).toString('base64');
 //const apiUrl = 'http://sap-pip.inkar.kz:53000/RESTAdapter/wseis';
  const apiUrl = 'http://localhost:5000/api/test';
  const axiosOptions = {
    method: 'post', 
    url: apiUrl,
    headers: {
     'Authorization': `Basic ${base64AuthString}`,
      'Content-Type': 'application/json', 
    },
    data: data
  };
  
    try {
      const response = await axios(axiosOptions);
      console.log('Ответ от сервера:', response.headers);
    } catch (error) {
      console.error('Ошибка запроса:', error.message);
    }
  };

  let x509Certificate = "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"
  let password = "As123456"
  let username = "730327401669"
  
  const digitalKeys = [
    {
      password: "As123456", //курмет
      username: "730327401669",
      body: {
        tin: "080540002682",
        x509Certificate: "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"
      }
    },
    {
      username: "940715300181", //Джиэнка
      password: "123456Aa",
      body: {
        tin: "040140005625",
      x509Certificate: "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"
        }  
      },
      {
        username: "850127402139", //Тенгри
        password: "Aaa1234",
        body: {
          tin: "210140007172", 
        x509Certificate: "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"
          }  
        },
        {
          username: "640311400016", //Аспект транс
          password: "Aa1234",
          body: {
            tin: "070340000324",
          x509Certificate: "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"
            }  
          },
          {
            username: "910421400035", //Асыл Ирбис
            password: "Aa123456",
            body: {
              tin: "110240001929",
            x509Certificate: "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"
              }  
            }

  ]

  

  cron.schedule('*/4 * * * *', () => {

    const promises = digitalKeys.map(async (key) => {
      try {
        const result = await sessionService('createSession', { 
          username: key.username, 
          password: key.password, 
          body: key.body 
        });
    
        const body = {
          sessionId: result.sessionId,
          criteria: {
            direction: 'INBOUND',
            dateFrom: (new Date('2023-11-01')).toISOString(),
            dateTo: (new Date('2023-11-27')).toISOString(),
            invoiceStatusList: {
              invoiceStatus: ['CREATED', 'DELIVERED', 'REVOKED', 'CANCELED'],
            },
            //...other,
            asc: true,
          },
        };
    
        const response = await invoiceService('queryInvoice', { body })

        const jsonData = await parseXml(response);
        const parsedData = jsonData.invoiceInfoList.invoiceInfo.map(async (item) => {

          return { 
            company: { 
             bin: item.invoice.consignor && item.invoice.consignor.tin ? item.invoice.consignor.tin : 'Not available', 
             company: item.invoice.consignor && item.invoice.consignor.name ? item.invoice.consignor.name : 'Not available', 
             address: item.invoice.consignor && item.invoice.consignor.address ? item.invoice.consignor.address : 'Not available', 
           }, 
           invoice: { 
             number: item.invoice.deliveryDocNum, 
             type: item.invoice.invoiceType, 
             status: item.invoiceStatus, 
             esf_num: item.invoiceId, 
             esf_long_num: item.registrationNumber, 
           }, 
           date: { 
             turnover: item.invoice.turnoverDate, 
             send: item.invoice.date, 
           }, 
           sum: { 
             withNDS: item.invoice.productSet.totalPriceWithTax, 
             withoutNds: item.invoice.productSet.totalPriceWithoutTax, 
           }, 
         };              
          
        });
    
       await writeToDatabase(parsedData);
    
        for (const data of parsedData) {
          await sendData(data);
        }
    
        return result; // or any other meaningful result
      } catch (error) {
        console.error(`Произошла ошибка: ${error}`);
        throw error; // propagate the error to Promise.all
      }
    });
    
    Promise.all(promises)
      .then((results) => {
        console.log(JSON.stringify(results));
      })
      .catch((error) => {
        console.error(`Произошла ошибка при обработке данных: ${error}`);
      });    
  });



  app.post('/v1/sessions/createsession', (req, res) => {
    const { username, password, x509Certificate } = req.body;
    const body = {
      tin: '080540002682',
      //tin: '080540002682',
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
