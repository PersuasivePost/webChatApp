import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";

@Module({
    imports: [PrismaModule],
    providers: [ChatGateway, ChatService],
    controllers: [ChatController],
    exports: [ChatService]
})

export class ChatModule {}