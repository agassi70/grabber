const cheerio = require('cheerio');
const request = require('request');
const moment = require('moment');

const fs = require('fs');

const jar = request.jar();

const year = new Date().getUTCFullYear();
const apiUrl = 'https://precisionrun.zingfit.com/reserve/index.cfm?';
const authForm = {
  action: 'Account.doLogin',
  username: 'a.baditsa@gmail.com',
  password: '15021988',
  rememberme: true,
};
const qsSchedule = {
  action: 'Reserve.chooseClass',
  site: 1,
  childId: 'zingfit-embed',
  parentTitle: 'Run, rebel, run.',
  parentUrl: 'https://precisionrun.com/reserve#/schedule/site/1'
};
const chooseSpot = {
  action: 'Reserve.chooseSpot',
  childId: 'zingfit-embed',
  parentTitle: 'Run, rebel, run.',
  parentUrl: 'https://precisionrun.com/reserve#/choosespot/classid/'
};

const getCookie = new Promise((resolve, reject) => {
  request({method: 'POST', url: apiUrl, form: authForm, jar}, (error, response, body) => {
    if (error) {
      reject(error);
    } else {
      const cookie = request.cookie('zingfitAuthenticated=true');
      jar.setCookie(cookie, apiUrl);
      resolve();
    }
  });
});

const getSchedule = new Promise((resolve, reject) => {
  request({url: apiUrl, qs: qsSchedule, jar}, (error, response, body) => {
    if (!error) {
      const $page = cheerio.load(body);
      const thead = $page('table thead td');
      const dates = thead.map(function(idx, elem) {
        const col = $page(this);
        return col.children('.thead-date').text();
      }).get();
      const table = $page('table .scheduleBlock.bookable');
      const result = [];

      table.each(function(idx, elem) {
        const block = $page(this);
        const className = block.parent('td').attr('class');
        const dateIdx = className.includes('today')
          ? 0
          : parseInt(className.slice(3));
        const time = block.children('.scheduleTime').text();
        // const timeArr = time.split(/\s/);
        // const length = timeArr[timeArr.length - 1];
        const cell = {
          room: block.data('room'),
          classId: block.data('classid'),
          classType: block.data('classtype'),
          instructorId: block.data('instructor'),
          instructorName: block.children('.scheduleInstruc').text(),
          time: moment(`${dates[dateIdx]} ${time}`, 'M.D h:m A').format('YYYY-MM-DD hh:mm A'),
          length: block.children('.scheduleTime').children('.classlength').text(),
        };
        result.push(cell);
      });

     // console.log(result);
      resolve(result);
    } else {
      reject(error);
    }
  });
});

const getSpot = (classid) => new Promise((resolve, reject) => {
  request({url: apiUrl, qs: {action: 'Reserve.chooseSpot', classid}, jar}, (error, response, body) => {
    if (!error) {
      const $page = cheerio.load(body);
      resolve({
        available: $page('#spotwrapper a.spotcell').contents().length,
        booked: $page('#spotwrapper span.spotcell').contents().length,
      });
    } else {
      reject(error);
    }
  });
});

getCookie
  .then(() => getSchedule)
  .then((result) => {
    const queries = result.map(cell => getSpot(cell.classId));
    return Promise.all(queries)
      .then(quantities => {
        const finResult = result.map((cell, idx) => ({...cell, ...quantities[idx]}));
         console.log(finResult);
        return finResult;
      });
  })
  .then(data => {
    const fileName = 'precisionrun.csv';
    const stream = fs.createWriteStream(fileName);
    stream.write('Date;Instructor;Datetime;Length;Treads;Enrolled treads;Open treads \r\n');
    data.forEach(row => {
      const rowArray = [
        moment().format('YYYY-MM-DD hh:mm A'),
        row.instructorName,
        row.time,
        row.length,
        +row.available + row.booked,
        row.booked,
        row.available,
      ];
      const rowString = rowArray.join(';') + '\r\n';
      stream.write(rowString);
    });
    stream.end();
  })
  .catch(err => console.log("Произошла ошибка: " + err));
