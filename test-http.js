const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 5000;

// Парсим JSON из тела запроса
app.use(bodyParser.json());

// Обработчик POST-запроса
app.post('/api/test', (req, res) => {
  const jsonData = req.body;

  // Выводим полученные данные в консоль
  console.log('Получены данные:', jsonData);

  // Отправляем ответ об успешном получении данных
  res.status(200).json({ message: 'Данные успешно получены' });
});

// Запускаем сервер на порту 3000
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
