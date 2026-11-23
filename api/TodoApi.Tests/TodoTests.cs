using System.Net;
using System.Net.Http.Json;
using TodoApi.Tests.TestSupport;

namespace TodoApi.Tests;

[Collection(ApiCollection.Name)]
public sealed class TodoTests(ApiFactory factory)
{
    private sealed record TodoDto(
        Guid Id, string Title, string? Notes, bool IsCompleted, DateTime? CompletedAt, DateTime CreatedAt, DateTime UpdatedAt);

    private sealed record ClearDto(int Deleted);

    private static async Task<TodoDto> CreateTodo(HttpClient client, string title = "Buy milk", string? notes = null)
    {
        var response = await client.PostAsJsonAsync("/api/todos", new { title, notes });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TodoDto>())!;
    }

    private static Task<HttpResponseMessage> Complete(HttpClient client, Guid id, bool isCompleted = true) =>
        client.PatchAsJsonAsync($"/api/todos/{id}", new { isCompleted });

    private static async Task<List<TodoDto>> List(HttpClient client, string query = "") =>
        (await client.GetFromJsonAsync<List<TodoDto>>($"/api/todos{query}"))!;

    // ---- authentication ----

    [Theory]
    [InlineData("GET", "/api/todos")]
    [InlineData("POST", "/api/todos")]
    [InlineData("GET", "/api/todos/00000000-0000-0000-0000-000000000001")]
    [InlineData("PUT", "/api/todos/00000000-0000-0000-0000-000000000001")]
    [InlineData("PATCH", "/api/todos/00000000-0000-0000-0000-000000000001")]
    [InlineData("DELETE", "/api/todos/00000000-0000-0000-0000-000000000001")]
    [InlineData("DELETE", "/api/todos/completed")]
    public async Task EveryEndpoint_RequiresAuthentication_AndNeverRedirects(string method, string path)
    {
        var client = factory.CreateApiClient();

        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path)
        {
            Content = JsonContent.Create(new { title = "x", isCompleted = true }),
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    // ---- CRUD ----

    [Fact]
    public async Task Crud_HappyPath()
    {
        var user = await factory.RegisterAsync();

        var created = await user.Client.PostAsJsonAsync("/api/todos", new { title = "Write plan", notes = "details" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var todo = (await created.Content.ReadFromJsonAsync<TodoDto>())!;
        Assert.Equal($"/api/todos/{todo.Id}", created.Headers.Location!.OriginalString);
        Assert.Equal("Write plan", todo.Title);
        Assert.Equal("details", todo.Notes);
        Assert.False(todo.IsCompleted);
        Assert.Null(todo.CompletedAt);

        var fetched = await user.Client.GetFromJsonAsync<TodoDto>($"/api/todos/{todo.Id}");
        Assert.Equal(todo.Id, fetched!.Id);

        var updated = await user.Client.PutAsJsonAsync($"/api/todos/{todo.Id}", new { title = "Write the plan", notes = (string?)null });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var updatedTodo = (await updated.Content.ReadFromJsonAsync<TodoDto>())!;
        Assert.Equal("Write the plan", updatedTodo.Title);
        Assert.Null(updatedTodo.Notes);
        Assert.True(updatedTodo.UpdatedAt >= todo.UpdatedAt);

        Assert.Equal(HttpStatusCode.NoContent, (await user.Client.DeleteAsync($"/api/todos/{todo.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await user.Client.GetAsync($"/api/todos/{todo.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await user.Client.DeleteAsync($"/api/todos/{todo.Id}")).StatusCode);
    }

    [Fact]
    public async Task Create_TrimsTitle_AndStoresBlankNotesAsNull()
    {
        var user = await factory.RegisterAsync();

        var todo = await CreateTodo(user.Client, title: "  padded title  ", notes: "   ");

        Assert.Equal("padded title", todo.Title);
        Assert.Null(todo.Notes);
    }

    [Fact]
    public async Task List_IsNewestFirst()
    {
        var user = await factory.RegisterAsync();
        var first = await CreateTodo(user.Client, "first");
        var second = await CreateTodo(user.Client, "second");
        var third = await CreateTodo(user.Client, "third");

        var titles = (await List(user.Client)).Select(t => t.Title).ToArray();

        Assert.Equal(["third", "second", "first"], titles);
        Assert.NotEqual(first.Id, third.Id);
        Assert.NotEqual(second.Id, third.Id);
    }

    // ---- validation ----

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Create_BlankTitle_Returns400(string title)
    {
        var user = await factory.RegisterAsync();

        var response = await user.Client.PostAsJsonAsync("/api/todos", new { title });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_MalformedJson_Returns400_NotA500()
    {
        var user = await factory.RegisterAsync();

        var response = await user.Client.PostAsync(
            "/api/todos", new StringContent("{ not json", System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_MissingBody_Returns400()
    {
        var user = await factory.RegisterAsync();

        var response = await user.Client.PostAsJsonAsync("/api/todos", new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_TitleOver200_OrNotesOver2000_Returns400()
    {
        var user = await factory.RegisterAsync();

        var longTitle = await user.Client.PostAsJsonAsync("/api/todos", new { title = new string('t', 201) });
        var longNotes = await user.Client.PostAsJsonAsync("/api/todos", new { title = "ok", notes = new string('n', 2001) });
        var boundary = await user.Client.PostAsJsonAsync("/api/todos", new { title = new string('t', 200), notes = new string('n', 2000) });

        Assert.Equal(HttpStatusCode.BadRequest, longTitle.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, longNotes.StatusCode);
        Assert.Equal(HttpStatusCode.Created, boundary.StatusCode);
    }

    [Fact]
    public async Task Update_BlankTitle_Returns400()
    {
        var user = await factory.RegisterAsync();
        var todo = await CreateTodo(user.Client);

        var response = await user.Client.PutAsJsonAsync($"/api/todos/{todo.Id}", new { title = " " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Patch_MissingIsCompleted_Returns400_AndDoesNotChangeTheTodo()
    {
        var user = await factory.RegisterAsync();
        var todo = await CreateTodo(user.Client);
        await Complete(user.Client, todo.Id);

        var response = await user.Client.PatchAsJsonAsync($"/api/todos/{todo.Id}", new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await user.Client.GetFromJsonAsync<TodoDto>($"/api/todos/{todo.Id}"))!.IsCompleted);
    }

    [Fact]
    public async Task NonGuidId_Returns404()
    {
        var user = await factory.RegisterAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await user.Client.GetAsync("/api/todos/not-a-guid")).StatusCode);
    }

    // ---- completion ----

    [Fact]
    public async Task Toggle_SetsAndClearsCompletedAt()
    {
        var user = await factory.RegisterAsync();
        var todo = await CreateTodo(user.Client);

        var done = (await (await Complete(user.Client, todo.Id)).Content.ReadFromJsonAsync<TodoDto>())!;
        Assert.True(done.IsCompleted);
        Assert.NotNull(done.CompletedAt);

        // Completing again is idempotent: the original completion time is kept.
        var again = (await (await Complete(user.Client, todo.Id)).Content.ReadFromJsonAsync<TodoDto>())!;
        Assert.Equal(done.CompletedAt, again.CompletedAt);

        var undone = (await (await Complete(user.Client, todo.Id, isCompleted: false)).Content.ReadFromJsonAsync<TodoDto>())!;
        Assert.False(undone.IsCompleted);
        Assert.Null(undone.CompletedAt);
    }

    [Fact]
    public async Task StatusFilter_SplitsActiveAndCompleted()
    {
        var user = await factory.RegisterAsync();
        var open = await CreateTodo(user.Client, "open");
        var finished = await CreateTodo(user.Client, "finished");
        await Complete(user.Client, finished.Id);

        var all = (await List(user.Client)).Select(t => t.Id).ToHashSet();
        var active = (await List(user.Client, "?status=active")).Select(t => t.Id).ToArray();
        var completed = (await List(user.Client, "?status=completed")).Select(t => t.Id).ToArray();
        var upper = (await List(user.Client, "?status=ACTIVE")).Select(t => t.Id).ToArray();

        Assert.Equal(new HashSet<Guid> { open.Id, finished.Id }, all);
        Assert.Equal([open.Id], active);
        Assert.Equal([finished.Id], completed);
        Assert.Equal([open.Id], upper);
    }

    [Fact]
    public async Task StatusFilter_UnknownValue_Returns400()
    {
        var user = await factory.RegisterAsync();

        var response = await user.Client.GetAsync("/api/todos?status=bogus");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ClearCompleted_RemovesOnlyCompletedTodos_AndReportsTheCount()
    {
        var user = await factory.RegisterAsync();
        var keep = await CreateTodo(user.Client, "keep");
        var a = await CreateTodo(user.Client, "a");
        var b = await CreateTodo(user.Client, "b");
        await Complete(user.Client, a.Id);
        await Complete(user.Client, b.Id);

        var response = await user.Client.DeleteAsync("/api/todos/completed");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, (await response.Content.ReadFromJsonAsync<ClearDto>())!.Deleted);
        Assert.Equal([keep.Id], (await List(user.Client)).Select(t => t.Id).ToArray());
    }

    // ---- tenant isolation ----

    [Fact]
    public async Task OtherUsersTodo_IsInvisibleAndImmutable_Returning404()
    {
        var alice = await factory.RegisterAsync();
        var bob = await factory.RegisterAsync();
        var todo = await CreateTodo(alice.Client, "alice's secret", notes: "private");

        Assert.Equal(HttpStatusCode.NotFound, (await bob.Client.GetAsync($"/api/todos/{todo.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.Client.PutAsJsonAsync($"/api/todos/{todo.Id}", new { title = "hijacked" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Complete(bob.Client, todo.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.Client.DeleteAsync($"/api/todos/{todo.Id}")).StatusCode);

        // Bob never sees it in a list...
        Assert.Empty(await List(bob.Client));

        // ...and none of his attempts changed it.
        var intact = (await alice.Client.GetFromJsonAsync<TodoDto>($"/api/todos/{todo.Id}"))!;
        Assert.Equal("alice's secret", intact.Title);
        Assert.False(intact.IsCompleted);
    }

    [Fact]
    public async Task ClearCompleted_NeverTouchesAnotherUsersTodos()
    {
        var alice = await factory.RegisterAsync();
        var bob = await factory.RegisterAsync();
        var alicesDone = await CreateTodo(alice.Client, "alice done");
        await Complete(alice.Client, alicesDone.Id);
        var bobsDone = await CreateTodo(bob.Client, "bob done");
        await Complete(bob.Client, bobsDone.Id);

        var response = await bob.Client.DeleteAsync("/api/todos/completed");

        Assert.Equal(1, (await response.Content.ReadFromJsonAsync<ClearDto>())!.Deleted);
        Assert.Equal(HttpStatusCode.OK, (await alice.Client.GetAsync($"/api/todos/{alicesDone.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.Client.GetAsync($"/api/todos/{bobsDone.Id}")).StatusCode);
    }

    [Fact]
    public async Task EachUser_OnlyListsTheirOwnTodos()
    {
        var alice = await factory.RegisterAsync();
        var bob = await factory.RegisterAsync();
        await CreateTodo(alice.Client, "a1");
        await CreateTodo(alice.Client, "a2");
        await CreateTodo(bob.Client, "b1");

        Assert.Equal(["a2", "a1"], (await List(alice.Client)).Select(t => t.Title).ToArray());
        Assert.Equal(["b1"], (await List(bob.Client)).Select(t => t.Title).ToArray());
    }
}
