import { Module } from "@nestjs/common";
import { PreferencesService } from "./preferences.service";
import { PreferencesMapperService } from "./preferences-mapper.service";

/**
 * Preferences Module
 *
 * Provides user preference evaluation for email notifications.
 */
@Module({
  providers: [PreferencesService, PreferencesMapperService],
  exports: [PreferencesService, PreferencesMapperService],
})
export class PreferencesModule {}

