const path=require('path');
const FILE_URL='file://'+path.resolve(__dirname,'../../web-html-code.html');

async function loadApp(p){
  await p.goto(FILE_URL,{waitUntil:'domcontentloaded'});
  await p.evaluate(()=>localStorage.clear());
  await p.reload({waitUntil:'load'});
  await p.waitForTimeout(600);
}

