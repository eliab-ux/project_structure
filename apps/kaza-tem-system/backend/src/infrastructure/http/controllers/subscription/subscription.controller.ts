import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { CreateSubscriptionUseCase } from '@contexts/subscription/application/use-cases/create-subscription/create-subscription.use-case';
import { CreateSubscriptionCommand } from '@contexts/subscription/application/use-cases/create-subscription/create-subscription.command';
import { CreateSubscriptionRequestDto } from './dto/create-subscription.request.dto';
import { GetSubscriptionUseCase } from '@contexts/subscription/application/use-cases/get-subscription/get-subscription.use-case';
import { GetSubscriptionQuery } from '@contexts/subscription/application/use-cases/get-subscription/get-subscription.query';
import { SubscriptionDto } from '@contexts/subscription/application/dto/subscription.dto';
import { CancelSubscriptionUseCase } from '@contexts/subscription/application/use-cases/cancel-subscription/cancel-subscription.use-case';
import { CancelSubscriptionCommand } from '@contexts/subscription/application/use-cases/cancel-subscription/cancel-subscription.command';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(
    private readonly createSubscription: CreateSubscriptionUseCase,
    private readonly getSubscription: GetSubscriptionUseCase,
    private readonly cancelSubscription: CancelSubscriptionUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSubscriptionRequestDto): Promise<SubscriptionDto> {
    const subscription = await this.createSubscription.execute(
      new CreateSubscriptionCommand(dto.resellerId, dto.card, dto.customer, dto.amount),
    );
    return subscription;
  }

  @Get('me')
  async me(@Query('resellerId') resellerId: string): Promise<SubscriptionDto | null> {
    if (!resellerId) {
      return null;
    }
    return this.getSubscription.execute(new GetSubscriptionQuery(resellerId));
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Query('subscriptionId') subscriptionId: string): Promise<void> {
    await this.cancelSubscription.execute(new CancelSubscriptionCommand(subscriptionId));
  }
}
