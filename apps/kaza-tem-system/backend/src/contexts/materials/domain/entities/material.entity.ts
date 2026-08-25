import { AggregateRoot } from '@gitspread/domain-primitives';
import { MaterialId } from '../value-objects/material-id.vo';
import { MaterialType } from '../value-objects/material-type.vo';

interface CreateMaterialProps {
  title: string;
  description?: string;
  type: MaterialType;
  fileUrl: string;
  thumbnailUrl?: string | null;
}

export class Material extends AggregateRoot {
  private constructor(
    private readonly _id: MaterialId,
    private _title: string,
    private _description: string,
    private readonly _type: MaterialType,
    private readonly _fileUrl: string,
    private readonly _thumbnailUrl: string | null,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(props: CreateMaterialProps): Material {
    const now = new Date();
    return new Material(
      MaterialId.generate(),
      props.title,
      props.description || '',
      props.type,
      props.fileUrl,
      props.thumbnailUrl ?? null,
      true,
      now,
      now,
    );
  }

  static reconstitute(
    id: MaterialId,
    title: string,
    description: string,
    type: MaterialType,
    fileUrl: string,
    thumbnailUrl: string | null,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): Material {
    return new Material(
      id,
      title,
      description,
      type,
      fileUrl,
      thumbnailUrl,
      isActive,
      createdAt,
      updatedAt,
    );
  }

  activate(): void {
    if (this._isActive) return;
    this._isActive = true;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    if (!this._isActive) return;
    this._isActive = false;
    this._updatedAt = new Date();
  }

  get id(): MaterialId {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get description(): string {
    return this._description;
  }

  get type(): MaterialType {
    return this._type;
  }

  get fileUrl(): string {
    return this._fileUrl;
  }

  get thumbnailUrl(): string | null {
    return this._thumbnailUrl;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
