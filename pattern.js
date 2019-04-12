function CharIsAlpha(char) {
  return /^[a-zA-Z]/.test(char);
}

function CharIsNumber(char) {
  return !CharIsAlpha(char) && /^[0-9]/.test(char);
}

function AreEqual(a, b) {
  return a.toString() == b.toString();
}

//-------------------------

let charTypes = ['a', 'n', 's'];
let patternTypes = ['alpha', 'numeric', 'alphanumeric'];

class CharInfoFactory {
  constructor() {
  }

  GetCharInfo(c) {
    let info = { char: c };

    if (CharIsAlpha(c))
      info.type = 'a';
    else if (CharIsNumber(c))
      info.type = 'n';
    else
      info.type = 's';

    return info;
  }
}

function GetPatternType(str) {
  let charInfoFactory = new CharInfoFactory();
  let charInfoArr = str.split('').map(char => charInfoFactory.GetCharInfo(char));

  let alphaCount = 0;
  let numericCount = 0;
  let symbolCount = 0;

  charInfoArr.forEach(info => {
    if (info.type == 'a')
      alphaCount += 1;
    else if (info.type == 'n')
      numericCount += 1;
    else if (info.type == 's')
      symbolCount += 1;
  });

  let patternType = null;

  if (symbolCount == 0) {
    if (alphaCount == charInfoArr.length)
      patternType = 'alpha';
    else if (numericCount == charInfoArr.length)
      patternType = 'numeric';
    else
      patternType = 'alphanumeric';
  }
  else
    patternType = 'symbols';

  return patternType;
}

class StringInfoFactory {
  constructor() {
    this.charInfoFactory = new CharInfoFactory();
  }

  GetStringInfo(str) {
    let charInfoArr = str.split('').map(c => this.charInfoFactory.GetCharInfo(c));

    // Build pattern string

    let patternParts = [];
    let patternStr = '';

    let currPatternStr = '';
    let currStr = '';
    let prevType = null;

    charInfoArr.forEach(info => {
      if (info.type == 's')
        patternStr += info.char;
      else
        patternStr += info.type;

      if (prevType) {
        if (info.type == prevType) {
          currPatternStr += info.type;
          currStr += info.char;
        }
        else {
          let partObj = {
            patternStr: currPatternStr,
            patternType: GetPatternType(currStr),
            value: currStr
          };

          patternParts.push(partObj);
          currPatternStr = info.type;
          currStr = info.char;
          prevType = info.type;
        }
      }
      else {
        currPatternStr += info.type;
        currStr += info.char;
        prevType = info.type;
      }
    });

    // Check if any leftover patterns are left
    if (currPatternStr.length > 0) {
      let partObj = {
        patternStr: currPatternStr,
        patternType: GetPatternType(currPatternStr),
        value: currStr
      };

      patternParts.push(partObj);
    }

    return {
      charInfoArr: charInfoArr,
      patternStr: patternStr,
      patternParts: patternParts
    };
  }
}

//----------------------------


function NumberPatternToFormatString(pattern) {
  let formatStr = null;

  if (pattern.length < 10)
    formatStr = `%0${pattern.length}d`;
  else
    formatStr = `%${pattern.length}d`;

  return formatStr;
}


function GetConsolidatedList(strArr) {
  if (strArr.length == 1)
    return strArr[0];

  // Get string infos
  let strInfoFactory = new StringInfoFactory();
  let infos = strArr.map(x => strInfoFactory.GetStringInfo(x));

  infos.forEach(x => {
    console.log(`\n\nCHAR_INFO_ARRAY: ${JSON.stringify(x.charInfoArr)}`);
    console.log(`PATTERN_STRING: ${x.patternStr}`);
    console.log(`PATTERN_PARTS: ${JSON.stringify(x.patternParts)}`);
  });

  // CONT 999
  // Conslidate filenames
}

//--------------------------------------
// TEST

let strArr = [
  'isa_1.png',
  'isa_2.png',
  'isa_arevalo.txt',
  'a.x',
  'b.x'
];

GetConsolidatedList(strArr);