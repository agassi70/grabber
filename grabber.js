const cheerio = require('cheerio');
const request = require('request');

const jar = request.jar();

const apiUrl = 'https://precisionrun.zingfit.com/reserve/index.cfm?';
const authForm = {action: 'Account.doLogin', username: 'a.baditsa@gmail.com', password: '15021988' };
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
  request.post({url: apiUrl, form: authForm, jar }, (error, response, body) => {
    if (error) {
      reject(error);
    } else {
      console.log(response.headers);
      // const authCookie = request.cookie('zingfitAuthenticated=true');
      // jar.setCookie(authCookie, apiUrl);
      resolve();
    }
  });
});

const getSchedule = new Promise((resolve, reject) => {
  request({url: apiUrl, qs: qsSchedule, jar}, (error, response, body) => {
    if (!error) {
      const $page = cheerio.load(body);
      const table = $page('table .scheduleBlock.bookable');

      const result = [];

      table.each(function(idx, elem) {
        const block = $page(this);
        const cell = {
          room: block.data('room'),
          classId: block.data('classid'),
          classType: block.data('classtype'),
          instructorId: block.data('instructor'),
          instructorName: block.children('.scheduleInstruc').text(),
          time: block.children('.scheduleTime').text(),
          href: block.children('a').attr('href'),
        };
        result.push(cell);
      });

      console.log(result);
      resolve(result);
    } else {
      reject(error);
    }
  });
});

getCookie.then(() => getSchedule)
  .then(result => {
    // console.log({...chooseSpot, classid: result[0].classId, parentUrl: `${chooseSpot.parentUrl}${result[0].classId}`});

    request({url: apiUrl, qs: {...chooseSpot, classid: result[0].classId, parentUrl: `${chooseSpot.parentUrl}${result[0].classId}`}, jar}, (error, response, body) => {
      if (!error) {
        const cookies = jar.getCookieString(apiUrl);
        console.log(cookies);
        const $page = cheerio.load(body);
       /// console.log($page.html());
      }
    });
  })
  .catch(err => console.log("Произошла ошибка: " + err));
