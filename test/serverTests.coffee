chai = require 'chai'
should = chai.should()
fs = require 'fs'
request = require 'request'
server = require '../server'
path = require 'path'

port = process.env.PORT
ip = process.env.IP
address = 'http://' + ip + ':' + port

describe 'Server tests', ->
    app = null
    
    before (done) ->
        app = server.listen(port, done)
        
    after (done) ->
        app.close(done)
        
    beforeEach ->
        cleanupFiles()
        
    afterEach ->
        cleanupFiles()
    
    describe 'GET', ->
        it 'returns index.html', (done) ->
            # Act
            request address, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(200)
                res.headers['content-type'].should.be.equal('text/html')
                fileContent = fs.readFileSync('public/index.html').toString()
                body.should.be.equal(fileContent)
                done()
                
        it 'returns 300 status code for bad url', (done) ->
            # Arrange
            url = address + '/a%AFc'
            
            # Act
            request url, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(300)
                res.body.should.be.equal('Bad request')
                done()
                
        it 'returns 400 for nested request with /', (done) ->
            # Arrange
            url = address + '/sub/file.ext'
            
            # Act
            request url, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(400)
                res.body.should.be.equal('Nested paths are not allowed')
                done()
                
        it 'returns 400 for nested request with ..', (done) ->
            # Arrange
            url = address + '/../file.ext'
            
            # Act
            request url, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(400)
                res.body.should.be.equal('Nested paths are not allowed')
                done()
                
        it 'returns 404 for non-existing file', (done) ->
            # Arrange
            url = address + '/file.ext'
            
            # Act
            request url, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(404)
                res.body.should.be.equal('File not found')
                done()
                
        it 'returns correct result for simple html file', (done) ->
            # Arrange
            url = address + '/html.html'
            
            # Act
            request url, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(200)
                res.headers['content-type'].should.be.equal('text/html')
                fileContent = fs.readFileSync('files/html.html').toString()
                body.should.be.equal(fileContent)
                done()
                
        it 'returns correct result for png file', (done) ->
            # Arrange
            url = address + '/small.png'
            
            # Act
            request url, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(200)
                res.headers['content-type'].should.be.equal('image/png')
                done()
                
    describe 'POST', ->
        newFilepath = 'files/new.txt'
        bigFilepath = 'files/bigfile.ext'
        bigpngFilepath = 'data/big.png'

        it 'returns 404 for empty filename', (done) ->
            # Act
            request.post(address, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(404)
                done())
                
        it 'returns 409 for existing file', (done) ->
            # Arrange
            url = address + '/html.html'
            
            # Act
            request.post({url: url, body: 'Some content'}, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(409)
                res.body.should.be.equal('File exists')
                done())
        
        it 'saves file if not exists', (done) ->
            # Arrange
            url = address + '/new.txt'
            content = 'New content'
            
            # Act
            request.post({url: url, body: content}, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(200)
                res.body.should.be.equal('OK')
                fileContent = fs.readFileSync(newFilepath).toString()
                content.should.be.equal(fileContent)
                done())
                
        it 'returns 413 if file size is greater than set limit (if correct header exists)', (done) ->
            # Arrange
            url = address + '/bigfile.ext'
            options = { 
                url: url, 
                body: 'some small content less than (1024 * 1024 + 1)'
                headers: {
                    'content-length': 1024 * 1024 + 1
                    }
            }
            
            # Act
            request.post(options, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(413)
                res.body.should.be.equal('File is too big!')
                fs.existsSync(path.join('files', 'bigfile.ext')).should.be.false
                done())
                
        it 'catches ECONNRESET file size is greater than set limit (if header is empty)', (done) ->
            # Arrange
            url = address + '/big.png'
            options = { 
                url: url, 
                body: fs.readFileSync(bigpngFilepath).toString()
                headers: {
                    'content-length': ''
                    }
            }
            
            # Act
            request.post(options, (error, res, body) ->
                # Assert
                error.code.should.be.equal('ECONNRESET')
                fs.existsSync(path.join('files', 'big.png')).should.be.false
                done())

    describe 'DELETE', ->
        it 'returns 404 for empty filename', (done) ->
            # Act
            request.delete(address, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(404)
                done())
                
        it 'deletes file correctly', (done) ->
            # Arrange
            url = address + '/new.txt'
            content = 'New content'
            request.post {url: url, body: content}, (err, r, b) ->
                done(err) if err
                # Act
                request.delete url, (error, res, body) ->
                    # Assert
                    done(error) if error
                    res.statusCode.should.be.equal(200)
                    fs.existsSync(path.join('files', 'new.txt')).should.be.false
                    done()
                
    describe 'PUT', ->
        it 'returns 502', (done) ->
            # Act
            request.put(address, (error, res, body) ->
                # Assert
                done(error) if error
                res.statusCode.should.be.equal(502)
                done())
                
cleanupFiles = ->
    acceptedFiles = ['html.html', 'locked.txt', 'small.png']
    fs.readdirSync('files').forEach (file) -> 
        fs.unlink(path.join('files', file), (err) -> ) if file not in acceptedFiles