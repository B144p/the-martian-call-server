import { Body, Controller, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MessageResponseDto } from './dto/message-response.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Send a message (start transmission)' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  sendMessage(
    @CurrentUser() user: User,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messagesService.sendMessage(user, dto.content);
  }

  @Patch(':id/interrupt')
  @HttpCode(200)
  @ApiOperation({ summary: 'Interrupt an active transmission' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  interruptMessage(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<MessageResponseDto> {
    return this.messagesService.interruptMessage(user, id);
  }
}
