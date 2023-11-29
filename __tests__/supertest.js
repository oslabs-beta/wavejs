const App = require("./App.js").default;
const request = require('supertest');


const port = 8000;

const server = 'http://localhost:8000';

describe('Express App', () => {
  describe('GET /', () => {
    test('should return status 200 and serve the HTML file', async () => {
      const response = await request(App).get('/');
      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
    });
  });


  beforeAll(() => {
    App.listen(port, () => {
      console.log('Listening on port', port);
    });
  });


  afterAll((done) => {
    App.close(() => {
      done();
    });
  });
});


describe('Route integration', () => {
    describe('/', () => {
      describe('GET', () => {
        it('responds with 200 status and text/html content type', () => {
          return request(server)
            .get('/')
            .expect('Content-Type', /text\/html/)
            .expect(200);
        });
      });
    });
});