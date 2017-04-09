var fs = require('fs');
var path = require("path");
var util = require("util");
var main = require('../notEs2016/index');
var Promise = require("q");


var readdir = Promise.denodeify(fs.readdir);
var readFile = Promise.denodeify(fs.readFile);

var logFilesDirectoryName = "log files";

var logFilesFilter = [];

var logFilesForce = [];

var logFilesDirectoryFullPaths = [
    /*	path.join(__dirname, logFilesDirectoryName, 'spare35'),
    	path.join(__dirname, logFilesDirectoryName, 'brice'),
    	path.join(__dirname, logFilesDirectoryName, 'iberia', 'alberto'),
    	path.join(__dirname, logFilesDirectoryName, 'iberia', 'ivan'),
    	path.join(__dirname, logFilesDirectoryName, 'iberia', 'renato'),
    	path.join(__dirname, logFilesDirectoryName, 'iberia', 'iberia aws'),
    	path.join(__dirname, logFilesDirectoryName, 'iberia', 'desktop'),*/
    path.join(__dirname, logFilesDirectoryName, 'scriptlogs')
];

main.getParser()
    .then(function(parser) {
        return Promise.all(logFilesDirectoryFullPaths.map(function(filePath) {
                console.log(filePath);
                return readdir(filePath)
                    .then(function(files) {
                        console.log(files);
                        return files.map(function(file) {
                                if (fs.lstatSync(path.join(filePath, file)).isFile()) {

                                    return {
                                        fileName: file,
                                        fullName: path.join(filePath, file)
                                    };

                                }

                                return false;
                            })
                            .filter(function(i) { return i && logFilesFilter.indexOf(i.fileName) == -1; })
                            .filter(function(i) { return i && (logFilesForce.length == 0 || logFilesForce.indexOf(i.fileName) !== -1); });
                    })
            }))
            .then(function(files) {
                console.log(files);
                return Promise.all([

                    parser,

                    [].concat.apply([], files)

                ]);
            })
    })
    .then(function(reply) {
        var parser = reply[0];
        var files = reply[1];

        return Promise.all(files.map(function(file) {
            return readFile(file.fullName, 'utf-8')
                .then(function(fileContent) {

                    return {
                        fullName: file.fullName,
                        fileName: file.fileName,
                        fileContent: fileContent
                    }

                })
                .then(function(file) {
                    var parsedFile = parseQlikLogFile(parser, file)
                    if (!parsedFile.parsed || (
                            parsedFile.result.filter(function(blk) { return blk.blockType == 'FAILED'; }).length == 0 &&
                            parsedFile.result.filter(function(blk) { return blk.blockType == 'UNKNOWN'; }).length > 0
                        )) {

                        var strParsed = util.inspect(parsedFile, { showHidden: false, depth: null, colors: false, maxArrayLength: null });

                        console.log('err', file.fileName);

                        fs.writeFileSync(path.join(__dirname, "output", 'err-' + file.fileName), strParsed);

                        return { type: 'err', file: file };

                    } else {

                        console.log('done', file.fileName);

                        fs.writeFileSync(path.join(__dirname, "output", 'done-' + file.fileName), JSON.stringify(parsedFile));

                        // return Promise.resolve(arr.concat([{ type: 'done', file: file }]));
                        return { type: "done", file: file };

                    }
                });
        }));
    })
    .then(function(resultArray) {
        console.log(resultArray);
        return resultArray;
    })
    .catch(function(error) {
        console.log(error);
    });


function parseQlikLogFile(parser, file) {

    try {

        var parsed = parser.parse(file.fileContent);
        parsed.fileName = file.fileName;

        return parsed

    } catch (e) {

        if (e.name === 'SyntaxError') {

            return {
                fileName: file.fileName,
                parsed: false,
                message: e.message,
                expected: e.expected,
                found: e.found,
                location: e.location
            }

        } else {
            throw e;
        }

    }

}