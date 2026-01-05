import { PartialType } from '@nestjs/swagger';
import { CreateHelpDeskDto } from './create-help-desk.dto';

export class UpdateHelpDeskDto extends PartialType(CreateHelpDeskDto) {}

