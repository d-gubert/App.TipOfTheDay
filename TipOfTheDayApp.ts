import {
    IAppAccessors,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo, RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IPostRoomUserJoined } from '@rocket.chat/apps-engine/definition/rooms';
import { IPostUserCreated, IPostUserLoggedIn, IUser, IUserContext } from '@rocket.chat/apps-engine/definition/users';
import { sendDirectMessage } from './src/lib/message';
import { userCreatedMessage } from './src/lib/tips';

export class TipOfTheDayApp extends App implements IPostUserCreated, IPostUserLoggedIn, IPostRoomUserJoined {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async executePostUserCreated(context: IUserContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
        if (context.performedBy) {
            this.getLogger().log('User created by another user');
            return;
        }

        // For future self: get user's language and translate accordingly
        await sendDirectMessage(read, modify, context.user, userCreatedMessage);
    }

    public async executePostUserLoggedIn(user: IUser, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
        const [loginInfo] = await read.getPersistenceReader().readByAssociations([
            new RocketChatAssociationRecord(RocketChatAssociationModel.USER, user.id),
            new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'loginInfo'),
        ]) as Array<{ lastLogin: Date, loginCount: number }>;

        // If the user has never logged in before, we don't want to send them a message
        if (!loginInfo) {
            await persistence.createWithAssociations({
                loginCount: 1,
                lastLogin: new Date(),
            }, [
                new RocketChatAssociationRecord(RocketChatAssociationModel.USER, user.id),
                new RocketChatAssociationRecord(RocketChatAssociationModel.MISC, 'loginInfo'),
            ]);

            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (loginInfo.lastLogin > today) {
            return;
        }



        // For future self: get user's language and translate accordingly
        sendDirectMessage(read, modify, user, userCreatedMessage);
    }
}
