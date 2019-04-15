let LinuxCommands = require('linux-commands-async');

//------------------------------------

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

  let consolidatedObjects = [];

  for (let i = 0; i < infos.length; ++i) {
    let currInfo = infos[i];

    if (!hasBeenConsolidated.includes(currInfo)) {
      let otherInfos = infos.filter(x => x != currInfo);
      let potentialMatches = GetOtherInfosWhereAllPartsMatchExceptForOne(currInfo, otherInfos);

      if (potentialMatches.length != 0) {
        let consolidationCount = 0;

        for (let k = 0; k < potentialMatches.length; ++k) {
          let currRemaining = potentialMatches[k];

          if (currInfo.patternStr == currRemaining.patternStr && AllPartsMatchExceptForOne(currInfo, currRemaining)) {
            let index = GetMismatchIndex(currInfo, currRemaining);
            let mismatchInfo = currRemaining.patternParts[index];
            let replacementStr = `[${mismatchInfo.patternStr.length}s]`;


            if (mismatchInfo.patternType == 'number') {
              replacementStr = `[${mismatchInfo.patternStr.length}n]`;
            }

            let strArr = currRemaining.patternParts.map(x => x.value);
            strArr[index] = replacementStr;

            consolidationCount += 1;
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
        doneChecking.push(currInfo);
        hasBeenConsolidated.push(currInfo);

        let name = currInfo.patternParts.map(x => x.value).join('');
        consolidatedNames.push(name);
      }
    }
  }

  return consolidatedNames;
}

function GetFilenamesAssociatedWith(filenameList, consolidatedString) {
  let startIndex = consolidatedString.indexOf('[');
  let endIndex = consolidatedString.indexOf(']');
  let formatStr = consolidatedString.substring(startIndex, endIndex + 1).replace('[', '').replace(']', '');
  let specifiedLength = parseInt(formatStr.substring(0, formatStr.length - 1));
  let strType = formatStr.charAt(formatStr.length - 1);

  let results = [];

  if (startIndex == 0) {
    let endStr = consolidatedString.substring(endIndex + 1);

    filenameList.forEach(filename => {
      if (filename.endsWith(endStr)) {
        let index = filename.indexOf(endStr);
        let leftStr = filename.substring(0, index);

        // Check length
        if (leftStr.length == specifiedLength) {

          // Check string type
          if (strType == 's') {

            // Check if string is alpha or alphanumeric
            let numChars = leftStr.filter(x => CharIsNumber(x));
            if (numChars.length != leftStr.length)
              results.push(filename);
          }
          else if (strType == 'n') {

            // Check if string is numeric
            let alphaChars = leftStr.filter(x => CharIsAlpha(x));
            if (alphaChars.length != leftStr.length)
              results.push(filename);
          }
        }
      }
    });
  }
  else if (endIndex == consolidatedString.length - 1) {
    let startStr = consolidatedString.substring(0, startIndex);

    filenameList.forEach(filename => {
      if (filename.startsWith(startStr)) {
        let rightStr = filename.substring(startIndex);

        // Check length
        if (rightStr.length == specifiedLength) {

          // Check string type
          if (strType == 's') {

            // Check if string is alpha or alphanumeric
            let numChars = rightStr.filter(x => CharIsNumber(x));
            if (numChars.length != rightStr.length)
              results.push(filename);
          }
          else if (strType == 'n') {

            // Check if string is numeric
            let alphaChars = rightStr.filter(x => CharIsAlpha(x));
            if (alphaChars.length != rightStr.length)
              results.push(filename);
          }
        }
      }
    });
  }
  else {
    let leftStr = consolidatedString.substring(0, startIndex + 1);
    let rightStr = consolidatedString.substring(endIndex + 1);

    filenameList.forEach(filename => {
      if (filename.startsWith(leftStr) && filename.endsWith(rightStr)) {
        let middleStartIndex = filename.indexOf(leftStr) + leftStr.length;
        let middleEndIndex = (filename.length - rightStr.length);
        let middleStr = filename.substring(middleStartIndex, middleEndIndex);

        // Check length
        if (middleStr.length == specifiedLength) {

          // Check string type
          if (strType == 's') {

            // Check if string is alpha or alphanumeric
            let numChars = middleStr.filter(x => CharIsNumber(x));
            if (numChars.length != middleStr.length)
              results.push(filename);
          }
          else if (strType == 'n') {

            // Check if string is numeric
            let alphaChars = middleStr.filter(x => CharIsAlpha(x));
            if (alphaChars.length != middleStr.length)
              results.push(filename);
          }
        }
      }
    });
  }

  return results;
}

//--------------------------------------
// TEST

let strArr = [
  'o_oo1.png',
  'o_oo2.png',
  'o_pp1.png',
  'o_ab1.png',
  'o_pp2.png',
  'connie a',
  'connie b',
  'a.gif',
  'b.gif'
];

let names = GetConsolidatedList(strArr);
console.log(`\nCONSOLIDATES_NAMES:\n${names.join('\n')}`);


let filenames = GetFilenamesAssociatedWith(strArr, names[0]);
console.log(`\n\nASSOCIATED WITH: ${names[0]}\n${filenames.join('\n')}`);