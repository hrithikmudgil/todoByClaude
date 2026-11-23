using System.Security.Claims;
using TodoApi.Data;
using TodoApi.Infrastructure;

namespace TodoApi.Features.Todos;

public static class TodoEndpoints
{
    public static IEndpointRouteBuilder MapTodoEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/todos").RequireAuthorization();

        group.MapGet("/", List);
        group.MapPost("/", Create);
        group.MapGet("/{id:guid}", Get);
        group.MapPut("/{id:guid}", Update);
        group.MapPatch("/{id:guid}", SetCompleted);
        group.MapDelete("/{id:guid}", Delete);
        group.MapDelete("/completed", ClearCompleted);

        return app;
    }

    private static async Task<IResult> List(
        ClaimsPrincipal user, TodoRepository todos, CancellationToken ct, string? status = null)
    {
        // Parsed by hand: built-in enum binding is case-sensitive and would reject "?status=active".
        if (!TryParseStatus(status, out var filter))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Invalid status filter.",
                detail: "status must be one of: all, active, completed.");
        }

        var items = await todos.ListAsync(user.GetUserId(), filter, ct);
        return Results.Ok(items.Select(TodoResponse.From));
    }

    private static bool TryParseStatus(string? value, out TodoStatus status)
    {
        switch (value?.Trim().ToLowerInvariant())
        {
            case null or "" or "all": status = TodoStatus.All; return true;
            case "active": status = TodoStatus.Active; return true;
            case "completed": status = TodoStatus.Completed; return true;
            default: status = TodoStatus.All; return false;
        }
    }

    private static async Task<IResult> Get(Guid id, ClaimsPrincipal user, TodoRepository todos, CancellationToken ct)
    {
        var item = await todos.GetAsync(user.GetUserId(), id, ct);
        return item is null ? Results.NotFound() : Results.Ok(TodoResponse.From(item));
    }

    private static async Task<IResult> Create(
        CreateTodoRequest request, ClaimsPrincipal user, TodoRepository todos, CancellationToken ct)
    {
        var item = await todos.CreateAsync(user.GetUserId(), request.Title.Trim(), NormalizeNotes(request.Notes), ct);
        return Results.Created($"/api/todos/{item.Id}", TodoResponse.From(item));
    }

    private static async Task<IResult> Update(
        Guid id, UpdateTodoRequest request, ClaimsPrincipal user, TodoRepository todos, CancellationToken ct)
    {
        var item = await todos.UpdateAsync(user.GetUserId(), id, request.Title.Trim(), NormalizeNotes(request.Notes), ct);
        return item is null ? Results.NotFound() : Results.Ok(TodoResponse.From(item));
    }

    private static async Task<IResult> SetCompleted(
        Guid id, SetCompletedRequest request, ClaimsPrincipal user, TodoRepository todos, CancellationToken ct)
    {
        var item = await todos.SetCompletedAsync(user.GetUserId(), id, request.IsCompleted!.Value, ct);
        return item is null ? Results.NotFound() : Results.Ok(TodoResponse.From(item));
    }

    private static async Task<IResult> Delete(Guid id, ClaimsPrincipal user, TodoRepository todos, CancellationToken ct) =>
        await todos.DeleteAsync(user.GetUserId(), id, ct) ? Results.NoContent() : Results.NotFound();

    private static async Task<IResult> ClearCompleted(ClaimsPrincipal user, TodoRepository todos, CancellationToken ct) =>
        Results.Ok(new ClearCompletedResponse(await todos.DeleteCompletedAsync(user.GetUserId(), ct)));

    /// <summary>Blank notes are stored as null.</summary>
    private static string? NormalizeNotes(string? notes) =>
        string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
}
