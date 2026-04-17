// import { Test, TestingModule } from '@nestjs/testing';
// import { ConfigService } from '@nestjs/config';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';

// describe('AppController', () => {
//   let appController: AppController;

//   beforeEach(async () => {
//     const app: TestingModule = await Test.createTestingModule({
//       controllers: [AppController],
//       providers: [
//         AppService,
//         {
//           provide: ConfigService,
//           useValue: {
//             get: jest.fn((key: string, defaultValue: string) => {
//               const config: Record<string, string> = {
//                 CHAIN: 'eth',
//                 NODE_ENV: 'test',
//               };
//               return config[key] || defaultValue;
//             }),
//           },
//         },
//       ],
//     }).compile();

//     appController = app.get<AppController>(AppController);
//   });

//   describe('getInfo', () => {
//     it('should return service info', () => {
//       const result = appController.getInfo();
//       expect(result).toHaveProperty('service', 'listener-engine');
//       expect(result).toHaveProperty('version');
//       expect(result).toHaveProperty('chain', 'eth');
//       expect(result).toHaveProperty('environment', 'test');
//       expect(result).toHaveProperty('timestamp');
//     });
//   });
// });

