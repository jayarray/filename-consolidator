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

  if (numericCount == charInfoArr.length)
    patternType = 'number';
  else
    patternType = 'string';

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

function HasNumericPart(strInfo) {
  let parts = strInfo.patternParts;

  for (let i = 0; i < parts.length; ++i) {
    let currPart = parts[i];

    if (currPart.patternType == 'number')
      return true;
  }

  return false;
}

function AllPartsMatchExceptForOne(strInfo1, strInfo2) {
  let parts1 = strInfo1.patternParts;
  let parts2 = strInfo2.patternParts;

  if (parts1.length != parts2.length)
    return false;

  let mismatchHappened = false;

  for (let i = 0; i < parts1.length; ++i) {
    let currPart1 = parts1[i];
    let currPart2 = parts2[i];

    if (currPart1.patternType == currPart2.patternType) {
      let value1 = currPart1.value;
      let value2 = currPart2.value;

      if (value1 != value2) {
        if (mismatchHappened)
          return false;

        mismatchHappened = true;
      }
    }
    else
      return false;
  }

  return true;
}

function AllPartsMatchForAtLeastOneOtherInfo(strInfo, otherInfosArr) {
  let boolArr = otherInfosArr.map(x => AllPartsMatchExceptForOne(strInfo, x));
  let trueItems = boolArr.filter(x => x == true);
  return trueItems.length > 0;
}

function GetOtherInfosWhereAllPartsMatchExceptForOne(strInfo, otherInfosArr) {
  let potentialMatches = otherInfosArr.filter(x => AllPartsMatchExceptForOne(strInfo, x) == true);
  return potentialMatches;
}

function GetMismatchIndex(strInfo1, strInfo2) {
  let parts1 = strInfo1.patternParts;
  let parts2 = strInfo2.patternParts;

  for (let i = 0; i < parts1.length; ++i) {
    let currPart1 = parts1[i].value;
    let currPart2 = parts2[i].value;

    if (currPart1 != currPart2)
      return i;
  }

  return null;
}


function GetConsolidatedList(strArr) {
  if (strArr.length == 1)
    return strArr[0];

  // Get string infos
  let strInfoFactory = new StringInfoFactory();
  let infos = strArr.map(x => strInfoFactory.GetStringInfo(x));

  // Conslidate filenames

  let doneChecking = [];  // Place info objects that have been checked here
  let hasBeenConsolidated = [];
  let consolidatedNames = [];

  console.log('\nConsolidating filenames...'); // DEBUG

  for (let i = 0; i < infos.length; ++i) {
    let currInfo = infos[i];
    console.log(`\n  CURR_INFO (i = ${i}): ${currInfo.patternParts.map(x => x.value).join('')}`); // DEBUG

    if (!hasBeenConsolidated.includes(currInfo)) {
      let otherInfos = infos.filter(x => x != currInfo).filter(x => !doneChecking.includes(x)).filter(x => !hasBeenConsolidated.includes(x));
      let potentialMatches = GetOtherInfosWhereAllPartsMatchExceptForOne(currInfo, otherInfos);

      if (potentialMatches.length != 0) {
        console.log(`  POTENTIAL_MATCHES (${potentialMatches.length}): ${potentialMatches.map(x => x.patternParts.map(y => y.value).join(''))}`); // DEBUG

        let consolidationCount = 0;

        for (let k = 0; k < potentialMatches.length; ++k) {
          let currRemaining = potentialMatches[k];
          console.log(`  REMAINING_INFO (k = ${k}): ${currRemaining.patternParts.map(x => x.value).join('')}`); // DEBUG

          if (currInfo.patternStr == currRemaining.patternStr && AllPartsMatchExceptForOne(currInfo, currRemaining)) {
            let index = GetMismatchIndex(currInfo, currRemaining);
            console.log(`  MISMATCH_INDEX = ${index}`); // DEBUG

            let replacementStr = '*';
            let mismatchInfo = currRemaining.patternParts[index];

            if (mismatchInfo.patternType == 'number') {
              let numFormatStr = NumberPatternToFormatString(mismatchInfo.patternStr);
              replacementStr = numFormatStr;
            }

            let strArr = currRemaining.patternParts.map(x => x.value);
            strArr[index] = replacementStr;

            consolidationCount += 1; // DEBUG
            let consolidatedStr = strArr.join('');

            if (!consolidatedNames.includes(consolidatedStr))
              consolidatedNames.push(consolidatedStr);

            if (!hasBeenConsolidated.includes(currRemaining))
              hasBeenConsolidated.push(currRemaining);

            doneChecking.push(currRemaining);
          }
        }

        if (consolidationCount == 0) {
          if (!hasBeenConsolidated.includes(currInfo))
            hasBeenConsolidated.push(currInfo);

          let name = currInfo.patternParts.map(x => x.value).join('');
          if (!consolidatedNames.includes(name))
            consolidatedNames.push(name);
        }

        doneChecking.push(currInfo);
      }
      else {
        console.log('  Info is unique.')
        doneChecking.push(currInfo);
        hasBeenConsolidated.push(currInfo);

        let name = currInfo.patternParts.map(x => x.value).join('');
        consolidatedNames.push(name);
      }
    }
  }

  console.log(`\nCONSOLIDATED_NAMES:`);
  consolidatedNames.forEach(str => {
    console.log(`  ${str}`);
  });

  return consolidatedNames;
}

//--------------------------------------
// TEST

let strArr = [
  'isa_1.png',
  'isa_2.png',
  'isa_arevalo.txt',
  'isa_zzzzzzz.txt',
  'isa_zuzuarregui.txt',
  'a.x',
  'b.x',
  '123.x',
  '001.x'
];

let names = GetConsolidatedList(strArr);
