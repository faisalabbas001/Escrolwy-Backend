import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PersonaService } from './persona.service';

/**
 * Persona Module
 *
 * Provides Persona KYC integration.
 */
@Module({
    imports: [ConfigModule],
    providers: [PersonaService],
    exports: [PersonaService],
})
export class PersonaModule { }
