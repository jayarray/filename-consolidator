let Path = require('path');
let LinuxCommands = require('linux-commands-async');

//------------------------------------

function CharIsAlpha(char) {
  return /^[a-zA-Z]/.test(char);
}

function CharIsNumber(char) {
  return !CharIsAlpha(char) && /^[0-9]/.test(char);
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

/**
 * Get a list of format strings that condense all filenames into fewer ones (if any are alike).
 * @param {Array<string>} strArr List of filenames.
 * @returns {Array<string>} Returns a list of strings.
 */
function GetConsolidatedFormatStrings(strArr) {
  if (strArr.length == 1)
    return strArr[0];

  // Get string infos
  let strInfoFactory = new StringInfoFactory();
  let infos = strArr.map(x => strInfoFactory.GetStringInfo(x));

  // Conslidate filenames

  let doneChecking = [];  // Place info objects that have been checked here
  let hasBeenConsolidated = [];
  let consolidatedNames = [];

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

/**
 * Get all filenames associated with the consolidated format string.
 * @param {Array<string>} filenameList 
 * @param {string} consolidatedString 
 * @returns {Array<string>} Returns a list of filenames that match the consolidated format string.
 */
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
          let chars = leftStr.split('');

          // Check string type
          if (strType == 's') {

            // Check if string is alpha or alphanumeric
            let numChars = chars.filter(x => CharIsNumber(x));
            if (numChars.length != leftStr.length)
              results.push(filename);
          }
          else if (strType == 'n') {

            // Check if string is numeric
            let alphaChars = chars.filter(x => CharIsAlpha(x));
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
          let chars = rightStr.split('');

          // Check string type
          if (strType == 's') {

            // Check if string is alpha or alphanumeric
            let numChars = chars.filter(x => CharIsNumber(x));
            if (numChars.length != rightStr.length)
              results.push(filename);
          }
          else if (strType == 'n') {

            // Check if string is numeric
            let alphaChars = chars.filter(x => CharIsAlpha(x));
            if (alphaChars.length != rightStr.length)
              results.push(filename);
          }
        }
      }
    });
  }
  else {
    let leftStr = consolidatedString.substring(0, startIndex);
    let rightStr = consolidatedString.substring(endIndex + 1);

    filenameList.forEach(filename => {
      if (filename.startsWith(leftStr) && filename.endsWith(rightStr)) {
        let middleStartIndex = filename.indexOf(leftStr) + leftStr.length;
        let middleEndIndex = (filename.length - rightStr.length);
        let middleStr = filename.substring(middleStartIndex, middleEndIndex);

        // Check length
        if (middleStr.length == specifiedLength) {
          let chars = middleStr.split('');

          // Check string type
          if (strType == 's') {

            // Check if string is alpha or alphanumeric
            let numChars = chars.filter(x => CharIsNumber(x));
            if (numChars.length != middleStr.length)
              results.push(filename);
          }
          else if (strType == 'n') {

            // Check if string is numeric
            let alphaChars = chars.filter(x => CharIsAlpha(x));
            if (alphaChars.length != middleStr.length)
              results.push(filename);
          }
        }
      }
    });
  }

  return results;
}

//------------------------------------

/**
 * Get a list of files whose names match the consolidated format string.
 * @param {string} dirPath 
 * @param {string} consolidatedString 
 * @returns {Promise<Array<string>>} Returns a Promise with the list of filenames.
 */
function GetFilenamesUsingFormatString(dirPath, consolidatedString) {
  return new Promise((resolve, reject) => {
    let startIndex = consolidatedString.indexOf('[');
    let endIndex = consolidatedString.indexOf(']');
    let formatStr = consolidatedString.substring(startIndex, endIndex + 1);
    let searchStr = consolidatedString.replace(formatStr, '*');

    LinuxCommands.Find.FilesByName(dirPath, searchStr, 1, LinuxCommands.Command.LOCAL).then(paths => {
      // Sort filepaths in alphabetical order
      let filepaths = paths.paths;
      filepaths.sort();

      // Convert to filenames
      let allFilenames = filepaths.map(x => LinuxCommands.Path.Filename(x));

      // Get all applicable filenames
      let theseFilenames = GetFilenamesAssociatedWith(allFilenames, consolidatedString);

      resolve(theseFilenames);
    }).catch(error => reject(`Failed to get filenames using format string: ${error}`));
  });
}
//--------------------------------------
// EXPORTS

exports.GetConsolidatedFormatStrings = GetConsolidatedFormatStrings;
exports.GetFilenamesAssociatedWith = GetFilenamesAssociatedWith;
exports.GetFilenamesUsingFormatString = GetFilenamesUsingFormatString;