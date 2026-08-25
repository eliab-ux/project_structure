import { CreateOrderDto } from '../../dto/create-order.dto';

export class CreateOrderCommand {
  constructor(public readonly payload: CreateOrderDto) {}
}
